// Transposing a built-in piece to another key. The interval comes from the circle of fifths
// (one fifth up = 4 letter steps and 7 semitones), and every note moves by letter steps and by
// semitones, so a written sharp or flat keeps its meaning in the new key (D sharp in A minor
// becomes F sharp in C minor). Pure; the tests check every piece in every offered key.
import { midiOf } from "./notes.js";

const STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Keys offered for transposing: up to three sharps or flats (as in the key-signature lessons). */
export const TRANSPOSE_FIFTHS = [-3, -2, -1, 0, 1, 2, 3];

export class TransposeError extends Error {}

/**
 * The two intervals from one key to another, up and down: [{ steps, semis }, { steps, semis }].
 * keyInterval() is the smaller move; transposePiece() picks the one easier to read.
 */
export function keyIntervals(fromFifths, toFifths) {
	const d = toFifths - fromFifths;
	const steps = (((d * 4) % 7) + 7) % 7;
	const semis = (((d * 7) % 12) + 12) % 12;
	if (!semis) return [{ steps: 0, semis: 0 }];
	return [
		{ steps, semis },
		{ steps: steps - 7, semis: semis - 12 },
	];
}

/** The smaller of the two moves from one key to another. */
export function keyInterval(fromFifths, toFifths) {
	return keyIntervals(fromFifths, toFifths).sort((a, b) => Math.abs(a.semis) - Math.abs(b.semis))[0];
}

// Notes that need ledger lines: below E4 or above F5 on the treble staff, below G2 or above A3 on the bass staff.
const OFF_STAFF = { right: (m) => m < 64 || m > 77, left: (m) => m < 43 || m > 57 };

function offStaff(piece, interval) {
	let n = 0;
	for (const part of ["right", "left"]) {
		if (!piece[part]) continue;
		for (const token of piece[part].trim().split(/\s+/)) {
			const m = /^(.*?)(w|hd|h|qd|q|e)$/.exec(token);
			if (!m || m[1] === "r") continue;
			for (const p of m[1].split("+")) {
				const [, step, sign, octave] = /^([A-G])(#|b)?(\d)$/.exec(p);
				if (OFF_STAFF[part](midiOf({ step, alter: sign === "#" ? 1 : sign === "b" ? -1 : 0, octave: Number(octave) }) + interval.semis)) n++;
			}
		}
	}
	return n;
}

/** One note { step, alter, octave } moved by { steps, semis }. */
export function transposeNote(n, { steps, semis }) {
	const index = STEPS.indexOf(n.step) + n.octave * 7 + steps;
	const step = STEPS[((index % 7) + 7) % 7];
	const octave = Math.floor(index / 7);
	const alter = midiOf(n) + semis - ((octave + 1) * 12 + NATURAL[step]);
	if (Math.abs(alter) > 1) throw new TransposeError(`${n.step}${n.octave} needs a double sharp or flat`);
	return { step, alter, octave };
}

/** A melody in the compact notation (src/core/notation.js), transposed token by token. */
export function transposeMelody(melody, interval) {
	return melody
		.trim()
		.split(/\s+/)
		.map((token) => {
			if (token === "|") return token;
			const m = /^(.*?)(w|hd|h|qd|q|e)$/.exec(token);
			if (!m || m[1] === "r") return token;
			const notes = m[1].split("+").map((p) => {
				const [, step, sign, octave] = /^([A-G])(#|b)?(\d)$/.exec(p);
				const n = transposeNote({ step, alter: sign === "#" ? 1 : sign === "b" ? -1 : 0, octave: Number(octave) }, interval);
				return `${n.step}${n.alter === 1 ? "#" : n.alter === -1 ? "b" : ""}${n.octave}`;
			});
			return `${notes.join("+")}${m[2]}`;
		})
		.join(" ");
}

/**
 * The piece in the key with `toFifths` sharps (or flats when negative); the same piece when
 * unchanged. Of the two directions it takes the one with fewer notes off the staff (fewer
 * ledger lines to read), and the smaller move when both are equal.
 */
export function transposePiece(piece, toFifths) {
	if (toFifths === piece.fifths) return piece;
	const interval = keyIntervals(piece.fifths, toFifths)
		.map((iv) => ({ iv, off: offStaff(piece, iv) }))
		.sort((a, b) => a.off - b.off || Math.abs(a.iv.semis) - Math.abs(b.iv.semis))[0].iv;
	return {
		...piece,
		fifths: toFifths,
		right: transposeMelody(piece.right, interval),
		...(piece.left ? { left: transposeMelody(piece.left, interval) } : {}),
		transposedFrom: piece.fifths,
	};
}
