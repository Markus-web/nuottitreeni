#!/usr/bin/env node
// Renders the piano samples used by the in-browser sampler (src/core/sound.js):
// one MP3 every 3 semitones from MIDI 24 to 108 (29 files), from the FluidR3_GM soundfont
// (MIT licence, Frank Wen). The sampler pitch-shifts the nearest sample by up to 1.5 semitones.
//
// Usage: node scripts/build-piano-samples.mjs [path/to/FluidR3_GM.sf2]
// Needs: fluidsynth and ffmpeg with libmp3lame. Output (committed, so contributors need no
// audio tools): src/assets/piano/<midi>.mp3, index.json, COPYING-FluidR3_GM.txt
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeSmf } from "../src/core/smf.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/assets/piano");
const sf2 = process.argv[2] || "/usr/share/soundfonts/FluidR3_GM.sf2";
const license = "/usr/share/licenses/soundfont-fluid/COPYING";
const NOTES = [];
for (let m = 24; m <= 108; m += 3) NOTES.push(m);
const HOLD_MS = 2200;
const LENGTH_S = 2.6;

if (!existsSync(sf2)) {
	console.error(`soundfont not found: ${sf2}`);
	process.exit(1);
}
mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "nt-samples-"));
try {
	for (const midi of NOTES) {
		const mid = join(work, `${midi}.mid`);
		const wav = join(work, `${midi}.wav`);
		writeFileSync(
			mid,
			encodeSmf(
				[
					{ type: "note", on: true, note: midi, vel: 100, t: 0 },
					{ type: "note", on: false, note: midi, t: HOLD_MS },
				],
				0,
				"sample",
			),
		);
		execFileSync("fluidsynth", ["-ni", "-q", "-g", "0.7", "-r", "44100", "-F", wav, sf2, mid], { stdio: ["ignore", "ignore", "inherit"] });
		execFileSync(
			"ffmpeg",
			[
				"-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-ac", "1",
				"-af", `silenceremove=start_periods=1:start_threshold=-60dB,afade=t=out:st=${LENGTH_S - 0.5}:d=0.5`,
				"-t", String(LENGTH_S), "-c:a", "libmp3lame", "-b:a", "64k", join(out, `${midi}.mp3`),
			],
			{ stdio: "inherit" },
		);
	}
	writeFileSync(join(out, "index.json"), `${JSON.stringify({ source: "FluidR3_GM (MIT)", notes: NOTES, format: "mp3" }, null, 2)}\n`);
	if (existsSync(license)) copyFileSync(license, join(out, "COPYING-FluidR3_GM.txt"));
	console.log(`rendered ${NOTES.length} samples into ${out}`);
} finally {
	rmSync(work, { recursive: true, force: true });
}
