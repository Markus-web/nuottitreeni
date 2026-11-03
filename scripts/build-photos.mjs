#!/usr/bin/env node
// Builds the page photos from the Unsplash sources listed in src/content/photos.js:
//   src/assets/photos/<id>-<width>.avif and .webp   (2:1 crop, widths from PHOTO_WIDTHS)
// The outputs are committed, so contributors only run this when a photo changes.
//
// Usage: node scripts/build-photos.mjs
// Needs: curl, ImageMagick 7 (magick) with WebP, and avifenc (libavif). Downloads are cached
// in ~/.cache/nuottitreeni-build/photos and checked against the sha256 in photos.js.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHOTO_ASPECT, PHOTO_WIDTHS, PHOTOS } from "../src/content/photos.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/assets/photos");
const cache = join(homedir(), ".cache/nuottitreeni-build/photos");
const AVIF_QUALITY = "55";
const WEBP_QUALITY = "72";

function fetchVerified(id, photo) {
	mkdirSync(cache, { recursive: true });
	const file = join(cache, `${id}.jpg`);
	if (!existsSync(file)) execFileSync("curl", ["-sSfL", "--max-time", "120", "-o", file, photo.source], { stdio: "inherit" });
	const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
	if (hash !== photo.sha256) throw new Error(`sha256 mismatch for ${id}: got ${hash}. Check the photo, then update photos.js.`);
	return file;
}

mkdirSync(out, { recursive: true });
const tmp = join(cache, "work");
mkdirSync(tmp, { recursive: true });
let total = 0;
for (const [id, photo] of Object.entries(PHOTOS)) {
	const { w, h, x, y } = photo.crop;
	if (Math.abs(w / h - PHOTO_ASPECT) > 0.001) throw new Error(`${id}: crop is not ${PHOTO_ASPECT}:1`);
	const file = fetchVerified(id, photo);
	for (const width of PHOTO_WIDTHS) {
		if (width > w) throw new Error(`${id}: crop ${w}px is narrower than output ${width}px`);
		const png = join(tmp, `${id}-${width}.png`);
		// Crop, scale, convert to sRGB 8-bit and drop metadata (EXIF, ICC beyond sRGB, comments).
		execFileSync("magick", [file, "-crop", `${w}x${h}+${x}+${y}`, "+repage", "-resize", `${width}x`, "-colorspace", "sRGB", "-depth", "8", "-strip", png]);
		const avif = join(out, `${id}-${width}.avif`);
		const webp = join(out, `${id}-${width}.webp`);
		execFileSync("avifenc", ["-q", AVIF_QUALITY, "-s", "4", "-y", "420", "--ignore-exif", "--ignore-xmp", png, avif], { stdio: "ignore" });
		execFileSync("magick", [png, "-quality", WEBP_QUALITY, "-define", "webp:method=6", webp]);
		rmSync(png);
		const sizes = [statSync(avif).size, statSync(webp).size];
		total += sizes[0] + sizes[1];
		console.log(`${id}-${width}: avif ${sizes[0]} B, webp ${sizes[1]} B`);
	}
}
console.log(`photos: ${(total / 1024).toFixed(0)} KiB in src/assets/photos`);
