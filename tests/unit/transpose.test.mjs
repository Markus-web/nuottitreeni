// Transposing built-in pieces (src/core/transpose.js): every piece in every offered key moves
// every note by the same interval, keeps the meaning of the key signature and needs no double
// sharps or flats.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PIECES, altersFor } from "../../src/content/catalog.js";
import { parseMelody } from "../../src/core/notation.js";
import { midiOf } from "../../src/core/notes.js";
import { TRANSPOSE_FIFTHS, keyInterval, keyIntervals, transposeNote, transposePiece } from "../../src/core/transpose.js";

const notesOf = (melody) => parseMelody(melody).flatMap((it) => (it.type === "note" ? it.notes : []));

test("intervals from the circle of fifths take the shorter way", () => {
	assert.deepEqual(keyInterval(0, 1), { steps: 4 - 7, semis: 7 - 12 }, "C to G: down a fourth");
	assert.deepEqual(keyInterval(0, -1), { steps: 3, semis: 5 }, "C to F: up a fourth");
	assert.deepEqual(keyInterval(0, 2), { steps: 1, semis: 2 }, "C to D: up a second");
	assert.deepEqual(keyInterval(0, -2), { steps: -1, semis: -2 }, "C to B flat: down a second");
	assert.deepEqual(keyInterval(1, 1), { steps: 0, semis: 0 });
});

test("single notes keep their letter-step meaning", () => {
	assert.deepEqual(transposeNote({ step: "C", alter: 0, octave: 4 }, keyInterval(0, 1)), { step: "G", alter: 0, octave: 3 });
	assert.deepEqual(transposeNote({ step: "B", alter: 0, octave: 4 }, keyInterval(0, 1)), { step: "F", alter: 1, octave: 4 }, "B in C major is F sharp in G major");
	assert.deepEqual(transposeNote({ step: "D", alter: 1, octave: 5 }, keyInterval(0, -3)), { step: "F", alter: 1, octave: 5 }, "D sharp in A minor is F sharp in C minor");
});

test("every piece in every offered key: same interval for every note, key signature kept", () => {
	for (const piece of PIECES) {
		for (const to of TRANSPOSE_FIFTHS) {
			const moved = transposePiece(piece, to);
			const first = notesOf(piece.right)[0];
			const semis = midiOf(notesOf(moved.right)[0]) - midiOf(first);
			assert.ok(keyIntervals(piece.fifths, to).some((iv) => iv.semis === semis), `${piece.id} to ${to}: one of the two intervals`);
			for (const part of ["right", "left"]) {
				if (!piece[part]) continue;
				const before = notesOf(piece[part]);
				const after = notesOf(moved[part]);
				assert.equal(after.length, before.length, `${piece.id} ${part} to ${to}`);
				const fromSig = altersFor(piece.fifths);
				const toSig = altersFor(to);
				before.forEach((n, i) => {
					const m = after[i];
					assert.equal(midiOf(m), midiOf(n) + semis, `${piece.id} to ${to}: note ${i + 1}`);
					assert.ok(Math.abs(m.alter) <= 1, `${piece.id} to ${to}: no double sharps or flats`);
					// A note that follows the old key signature follows the new one.
					if (n.alter === (fromSig[n.step] ?? 0)) assert.equal(m.alter, toSig[m.step] ?? 0, `${piece.id} to ${to}: note ${i + 1} follows the key signature`);
				});
			}
			assert.equal(moved.fifths, to);
		}
	}
});

test("Ukko Nooa in G major goes up a fifth, onto the staff, rather than down below it", () => {
	const g = transposePiece(PIECES.find((p) => p.id === "ukko-nooa"), 1);
	assert.match(g.right, /^G4q G4q G4q B4q/);
	const f = transposePiece(PIECES.find((p) => p.id === "ukko-nooa"), -1);
	assert.match(f.right, /^F4q F4q F4q A4q/, "F major: up a fourth");
	assert.equal(transposePiece(PIECES[0], PIECES[0].fifths), PIECES[0], "unchanged key returns the same piece");
});

test("the piece page offers the same keys as the transposer", async () => {
	const { readFileSync } = await import("node:fs");
	const page = readFileSync(new URL("../../src/pages/piece.js", import.meta.url), "utf8");
	assert.match(page, new RegExp(`const TRANSPOSE_FIFTHS = \\[${TRANSPOSE_FIFTHS.join(", ")}\\]`));
});
