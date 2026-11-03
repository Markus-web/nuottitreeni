// Why a note on the staff has its name: position counted from the bottom line, what the
// clef makes of that place, and any sign. Returns i18n keys + variables; the UI turns them
// into text. Pure, so the build, the browser and the tests share it.
import { MIDDLE_C, diatonic, midiOf } from "./notes.js";

/** Diatonic position of each staff's bottom line: treble E4, bass G2. */
export const BOTTOM_LINE = { treble: 30, bass: 18 };

/**
 * Where a note sits relative to a five-line staff.
 * kinds: line (1-5), space (1-4), below / above (just outside the staff),
 * ledgerBelow / ledgerAbove (on ledger line n), belowLedger / aboveLedger (just past ledger line n)
 */
export function staffPosition(note, clef = note.clef) {
	const off = diatonic(note) - BOTTOM_LINE[clef];
	if (off >= 0 && off <= 8) return off % 2 === 0 ? { kind: "line", n: off / 2 + 1 } : { kind: "space", n: (off + 1) / 2 };
	if (off === -1) return { kind: "below", n: 0 };
	if (off === 9) return { kind: "above", n: 0 };
	if (off < -1) return -off % 2 === 0 ? { kind: "ledgerBelow", n: -off / 2 } : { kind: "belowLedger", n: (-off - 1) / 2 };
	const o = off - 8;
	return o % 2 === 0 ? { kind: "ledgerAbove", n: o / 2 } : { kind: "aboveLedger", n: (o - 1) / 2 };
}

/**
 * Explanation parts for a missed note. `note` has step/alter/octave/clef and `written`
 * (the sign drawn next to it, or null). Pitch-class notes (octave null) get the key-finding hint.
 */
export function explainParts(note) {
	if (note.octave == null) return [{ key: "explain.keys", vars: { step: note.step, alter: note.alter || 0 } }];
	const parts = [];
	const pos = staffPosition(note);
	parts.push({ key: `explain.pos.${pos.kind}`, vars: { n: pos.n } });
	parts.push({ key: note.clef === "treble" ? "explain.clef.treble" : "explain.clef.bass", vars: { step: note.step, alter: 0 } });
	if (midiOf(note) === MIDDLE_C) parts.push({ key: "explain.middleC", vars: {} });
	if (note.written === 1) parts.push({ key: "explain.sharp", vars: { step: note.step, alter: 1 } });
	else if (note.written === -1) parts.push({ key: "explain.flat", vars: { step: note.step, alter: -1 } });
	else if (note.alter) parts.push({ key: "explain.keySig", vars: { step: note.step, alter: note.alter } });
	return parts;
}
