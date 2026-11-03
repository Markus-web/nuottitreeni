import assert from "node:assert/strict";
import { test } from "node:test";
import { blackKeyName, diatonic, hSystemName, letterName, midiLabel, midiOf, noteKey, parseNoteKey, spellMidi, whiteRange } from "../../src/core/notes.js";

test("MIDI numbers in scientific pitch (C4 = 60)", () => {
	assert.equal(midiOf({ step: "C", alter: 0, octave: 4 }), 60);
	assert.equal(midiOf({ step: "A", alter: 0, octave: 0 }), 21);
	assert.equal(midiOf({ step: "C", alter: 0, octave: 8 }), 108);
	assert.equal(midiOf({ step: "F", alter: 1, octave: 4 }), 66);
	assert.equal(midiOf({ step: "B", alter: -1, octave: 4 }), 70);
	assert.equal(diatonic({ step: "E", octave: 4 }), 30);
});

test("H-system names (Finnish/German)", () => {
	const expect = { "C,0": "C", "C,1": "Cis", "D,-1": "Des", "E,-1": "Es", "A,-1": "As", "B,0": "H", "B,-1": "B", "B,1": "His", "G,-1": "Ges", "F,1": "Fis" };
	for (const [k, v] of Object.entries(expect)) {
		const [step, alter] = k.split(",");
		assert.equal(hSystemName(step, Number(alter)), v, k);
	}
	assert.equal(letterName("B", 0), "B");
	assert.equal(letterName("B", -1), "B♭");
	assert.equal(letterName("F", 1), "F♯");
});

test("spelling and labels", () => {
	assert.deepEqual(spellMidi(61), { step: "C", alter: 1, octave: 4 });
	assert.deepEqual(spellMidi(61, "flat"), { step: "D", alter: -1, octave: 4 });
	assert.equal(midiLabel(71, "h-system"), "H4");
	assert.equal(midiLabel(71, "letters"), "B4");
	assert.equal(blackKeyName(70, "h-system"), "Ais/B");
	assert.equal(blackKeyName(66, "letters"), "F♯/G♭");
});

test("note keys round-trip", () => {
	for (const k of ["C4", "F#4", "Bb3", "C", "G#"]) {
		const n = parseNoteKey(k);
		assert.equal(noteKey(n.step, n.alter, n.octave), k);
	}
	assert.equal(parseNoteKey("H4"), null);
	assert.deepEqual(whiteRange("C4", "G4").map((n) => noteKey(n.step, 0, n.octave)), ["C4", "D4", "E4", "F4", "G4"]);
});
