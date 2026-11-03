import assert from "node:assert/strict";
import { test } from "node:test";
import { explainParts, staffPosition } from "../../src/core/explain.js";
import { parseNoteKey } from "../../src/core/notes.js";

const pos = (key, clef) => staffPosition({ ...parseNoteKey(key), clef });

test("treble staff positions", () => {
	assert.deepEqual(pos("E4", "treble"), { kind: "line", n: 1 });
	assert.deepEqual(pos("G4", "treble"), { kind: "line", n: 2 });
	assert.deepEqual(pos("F5", "treble"), { kind: "line", n: 5 });
	assert.deepEqual(pos("F4", "treble"), { kind: "space", n: 1 });
	assert.deepEqual(pos("E5", "treble"), { kind: "space", n: 4 });
	assert.deepEqual(pos("D4", "treble"), { kind: "below", n: 0 });
	assert.deepEqual(pos("C4", "treble"), { kind: "ledgerBelow", n: 1 });
	assert.deepEqual(pos("B3", "treble"), { kind: "belowLedger", n: 1 });
	assert.deepEqual(pos("A3", "treble"), { kind: "ledgerBelow", n: 2 });
	assert.deepEqual(pos("G5", "treble"), { kind: "above", n: 0 });
	assert.deepEqual(pos("A5", "treble"), { kind: "ledgerAbove", n: 1 });
	assert.deepEqual(pos("B5", "treble"), { kind: "aboveLedger", n: 1 });
	assert.deepEqual(pos("C6", "treble"), { kind: "ledgerAbove", n: 2 });
});

test("bass staff positions", () => {
	assert.deepEqual(pos("G2", "bass"), { kind: "line", n: 1 });
	assert.deepEqual(pos("F3", "bass"), { kind: "line", n: 4 });
	assert.deepEqual(pos("A3", "bass"), { kind: "line", n: 5 });
	assert.deepEqual(pos("A2", "bass"), { kind: "space", n: 1 });
	assert.deepEqual(pos("F2", "bass"), { kind: "below", n: 0 });
	assert.deepEqual(pos("E2", "bass"), { kind: "ledgerBelow", n: 1 });
	assert.deepEqual(pos("C2", "bass"), { kind: "ledgerBelow", n: 2 });
	assert.deepEqual(pos("B3", "bass"), { kind: "above", n: 0 });
	assert.deepEqual(pos("C4", "bass"), { kind: "ledgerAbove", n: 1 });
	assert.deepEqual(pos("E4", "bass"), { kind: "ledgerAbove", n: 2 });
});

test("explanation parts", () => {
	const c4 = { ...parseNoteKey("C4"), clef: "treble", written: null };
	assert.deepEqual(explainParts(c4).map((p) => p.key), ["explain.pos.ledgerBelow", "explain.clef.treble", "explain.middleC"]);
	const fis = { step: "F", alter: 1, octave: 4, clef: "treble", written: 1 };
	assert.equal(explainParts(fis).at(-1).key, "explain.sharp");
	const keySigF = { step: "F", alter: 1, octave: 4, clef: "treble", written: null };
	assert.equal(explainParts(keySigF).at(-1).key, "explain.keySig");
	assert.equal(explainParts({ step: "C", alter: 0, octave: null })[0].key, "explain.keys");
});
