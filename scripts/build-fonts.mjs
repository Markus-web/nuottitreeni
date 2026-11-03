#!/usr/bin/env node
// Builds the two bundled web fonts from pinned upstream releases (both SIL OFL 1.1):
//   src/assets/fonts/space-grotesk.woff2  headings (Space Grotesk 2.0.0, variable weight, Latin + Finnish)
//   src/assets/fonts/nt-music.woff2       clefs, accidentals and rests (Noto Music v2.004 subset)
// plus the licence texts next to them. Body text uses the system UI font (no download).
//
// Usage: node scripts/build-fonts.mjs
// Needs: curl, unzip, and pyftsubset with brotli (pip install fonttools brotli); set
// PYFTSUBSET=/path/to/pyftsubset if it is not on PATH. Downloads are cached in
// ~/.cache/nuottitreeni-build and checked against the sha256 values below.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/assets/fonts");
const cache = join(homedir(), ".cache/nuottitreeni-build");
const pyftsubset = process.env.PYFTSUBSET || "pyftsubset";

const SOURCES = {
	spaceGrotesk: {
		url: "https://github.com/floriankarsten/space-grotesk/releases/download/2.0.0/SpaceGrotesk-2.0.0.zip",
		sha256: "53b415577d4139248555300710bea0d268c7a5be67b93de53b716a9736cabffd",
		font: "SpaceGrotesk-2.0.0/ttf/SpaceGrotesk[wght].ttf",
		license: "SpaceGrotesk-2.0.0/OFL.txt",
	},
	notoMusic: {
		url: "https://github.com/notofonts/music/releases/download/NotoMusic-v2.004/NotoMusic-v2.004.zip",
		sha256: "47c784aa4c73aceca48cfbb6959cfdf71b524d257eb453ef97ad3640a37e396d",
		font: "NotoMusic/unhinted/ttf/NotoMusic-Regular.ttf",
		license: "OFL.txt",
	},
};

// Latin + Latin-1 (covers Finnish, Swedish, German and most Western European languages).
const TEXT_UNICODES = "U+0020-007E,U+00A0-00FF,U+0152-0153,U+0160-0161,U+017D-017E,U+2013,U+2018-201E,U+2022,U+2026,U+2039-203A,U+20AC,U+2122";
// G clef, F clef, whole/half/quarter/eighth rests, flat, natural, sharp.
const MUSIC_UNICODES = "U+1D11E,U+1D122,U+1D13B-1D13E,U+266D-266F";

function fetchVerified(src) {
	mkdirSync(cache, { recursive: true });
	const file = join(cache, src.url.split("/").pop());
	if (!existsSync(file)) execFileSync("curl", ["-sSfL", "--max-time", "180", "-o", file, src.url], { stdio: "inherit" });
	const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
	if (hash !== src.sha256) throw new Error(`sha256 mismatch for ${file}: ${hash}`);
	return file;
}

function extract(zip, member, dest) {
	// unzip treats [ ] as wildcards; escape them so names like "SpaceGrotesk[wght].ttf" match literally.
	const pattern = member.replace(/[[\]]/g, (c) => `\\${c}`);
	writeFileSync(dest, execFileSync("unzip", ["-p", zip, pattern], { maxBuffer: 64 * 1024 * 1024 }));
}

function subset(input, output, unicodes, extra = []) {
	execFileSync(pyftsubset, [input, `--unicodes=${unicodes}`, "--flavor=woff2", "--layout-features=kern,liga", "--no-hinting", "--desubroutinize", `--output-file=${output}`, ...extra], {
		stdio: "inherit",
	});
}

mkdirSync(out, { recursive: true });
const tmp = join(cache, "extract");
mkdirSync(tmp, { recursive: true });

const sgZip = fetchVerified(SOURCES.spaceGrotesk);
extract(sgZip, SOURCES.spaceGrotesk.font, join(tmp, "SpaceGrotesk.ttf"));
extract(sgZip, SOURCES.spaceGrotesk.license, join(out, "OFL-SpaceGrotesk.txt"));
subset(join(tmp, "SpaceGrotesk.ttf"), join(out, "space-grotesk.woff2"), TEXT_UNICODES);

const nmZip = fetchVerified(SOURCES.notoMusic);
extract(nmZip, SOURCES.notoMusic.font, join(tmp, "NotoMusic.ttf"));
extract(nmZip, SOURCES.notoMusic.license, join(out, "OFL-NotoMusic.txt"));
subset(join(tmp, "NotoMusic.ttf"), join(out, "nt-music.woff2"), MUSIC_UNICODES, ["--layout-features=", "--name-IDs=*"]);

for (const f of ["space-grotesk.woff2", "nt-music.woff2"]) console.log(`${f}: ${readFileSync(join(out, f)).length} bytes`);
