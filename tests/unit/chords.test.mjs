// Interval and chord names in the note explorer (src/core/chords.js).
import assert from "node:assert/strict";
import { test } from "node:test";
import { INTERVALS, nameChord, nameInterval } from "../../src/core/chords.js";
import en from "../../src/content/locales/en.js";
import fi from "../../src/content/locales/fi.js";

test("every interval from a minor second to an octave, and compound intervals", () => {
	for (let d = 1; d <= 12; d++) assert.deepEqual(nameInterval(60, 60 + d), { key: INTERVALS[d], octaves: 0 }, `${d} semitones`);
	assert.deepEqual(nameInterval(64, 60), { key: "major3", octaves: 0 }, "order does not matter");
	assert.deepEqual(nameInterval(60, 76), { key: "major3", octaves: 1 }, "a tenth is a third plus an octave");
	assert.deepEqual(nameInterval(48, 72), { key: "octave", octaves: 1 }, "two octaves");
});

test("triads in every inversion on several roots", () => {
	const shapes = { major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6] };
	for (const root of [60, 66, 70, 59]) {
		for (const [quality, shape] of Object.entries(shapes)) {
			const notes = shape.map((s) => root + s);
			assert.deepEqual(nameChord(notes), { root: root % 12, quality, inversion: 0 }, `${quality} on ${root}, root position`);
			assert.deepEqual(nameChord([notes[1], notes[2], notes[0] + 12]), { root: root % 12, quality, inversion: 1 }, `${quality} on ${root}, first inversion`);
			assert.deepEqual(nameChord([notes[2], notes[0] + 12, notes[1] + 12]), { root: root % 12, quality, inversion: 2 }, `${quality} on ${root}, second inversion`);
		}
	}
	assert.deepEqual(nameChord([48, 64, 67, 72]), { root: 0, quality: "major", inversion: 0 }, "doubled notes are fine");
	assert.deepEqual(nameChord([60, 64, 68]), { root: 0, quality: "augmented", inversion: 0 }, "augmented: the lowest note is the root");
});

test("seventh chords", () => {
	assert.deepEqual(nameChord([55, 59, 62, 65]), { root: 7, quality: "dominant7", inversion: 0 }, "G7");
	assert.deepEqual(nameChord([59, 62, 65, 67]), { root: 7, quality: "dominant7", inversion: 1 }, "G7 with B lowest");
	assert.deepEqual(nameChord([60, 64, 67, 71]), { root: 0, quality: "major7", inversion: 0 }, "Cmaj7");
	assert.deepEqual(nameChord([57, 60, 64, 67]), { root: 9, quality: "minor7", inversion: 0 }, "Am7, not C6");
});

test("unknown sets and too few notes give no chord", () => {
	assert.equal(nameChord([60, 61, 62]), null);
	assert.equal(nameChord([60, 64]), null);
	assert.equal(nameChord([60, 72, 84]), null, "one pitch class");
});

test("every interval and chord has text in every locale", () => {
	for (const dict of [fi, en]) {
		for (const key of INTERVALS) assert.ok(dict.chords.intervals[key], key);
		for (const q of ["major", "minor", "diminished", "augmented", "dominant7", "major7", "minor7"]) assert.match(dict.chords.quality[q], /\{root(Lower)?\}/, q);
		assert.equal(dict.chords.inversions.length, 4);
	}
});
