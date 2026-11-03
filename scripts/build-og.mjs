#!/usr/bin/env node
// Social preview images (Open Graph, 1200x630) per locale, drawn with the app's own staff
// renderer so the preview shows real notation. Outputs src/assets/og/og-<locale>.png.
// Needs rsvg-convert and the system fonts "Noto Sans" and "Noto Music" (only for this build
// step; the site itself ships its own fonts).
// Usage: node scripts/build-og.mjs   (outputs are committed)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { whiteRange } from "../src/core/notes.js";
import { escapeXml, renderStaff } from "../src/core/staff.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/assets/og");
mkdirSync(out, { recursive: true });
const locales = { fi: (await import("../src/content/locales/fi.js")).default, en: (await import("../src/content/locales/en.js")).default };

for (const [code, loc] of Object.entries(locales)) {
	const names = loc.meta.noteNames === "h-system" ? ["C", "D", "E", "F", "G"] : ["C", "D", "E", "F", "G"];
	const staff = renderStaff({
		staff: "treble",
		items: whiteRange("C4", "G4").map((n, i) => ({ type: "note", value: "q", notes: [{ ...n, clef: "treble", written: null }], label: names[i] })),
	})
		.replace(/^<svg [^>]*>/, "")
		.replace(/<\/svg>$/, "");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<style>
.st-line,.st-stem,.st-bar{stroke:#f2f2f2;stroke-width:1.6}.st-head,.st-fill{fill:#f2f2f2}.st-clef{font-family:'Noto Music';fill:#f2f2f2}
.st-clef-treble{font-size:66px}.st-label{font-family:'Noto Sans';font-weight:700;font-size:15px;fill:#4dcc84}
</style>
<rect width="1200" height="630" fill="#000"/>
<rect x="80" y="560" width="1040" height="8" fill="#15b064"/>
<text x="80" y="150" font-family="Noto Sans" font-weight="700" font-size="76" fill="#f2f2f2">${escapeXml(loc.site.name)}</text>
<text x="80" y="220" font-family="Noto Sans" font-size="36" fill="#c8c8c8">${escapeXml(loc.site.tagline)}</text>
<g transform="translate(80 250) scale(2.1)">${staff}</g>
</svg>`;
	const svgFile = join(out, `og-${code}.svg.tmp`);
	writeFileSync(svgFile, svg);
	execFileSync("rsvg-convert", ["-w", "1200", "-h", "630", svgFile, "-o", join(out, `og-${code}.png`)]);
	rmSync(svgFile);
	console.log(`og-${code}.png`);
}
