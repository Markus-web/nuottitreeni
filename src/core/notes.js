// Note model shared by the browser, the build and the tests. Pure functions only.
//
// A spelled note is { step: "C".."B", alter: -1 | 0 | 1, octave } in scientific pitch
// notation, where C4 is middle C (MIDI 60). `octave: null` means "any octave" (pitch class).
//
// Two naming systems exist and each locale picks one (locale meta.noteNames):
//   "letters"  : C D E F G A B with ♯/♭ (English and most languages)
//   "h-system" : C D E F G A H; B means B♭; sharps add -is, flats -es (Finnish, German, Nordic)

export const STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const SEMITONE = [0, 2, 4, 5, 7, 9, 11];

/** Full piano range; inputs outside it are ignored. */
export const PIANO_LOW = 21; // A0
export const PIANO_HIGH = 108; // C8
export const MIDDLE_C = 60;

export function midiOf(note) {
	return (note.octave + 1) * 12 + SEMITONE[STEPS.indexOf(note.step)] + (note.alter || 0);
}

/** Diatonic position (C0 = 0): one step per staff line or space. */
export function diatonic(note) {
	return note.octave * 7 + STEPS.indexOf(note.step);
}

export function pitchClass(midi) {
	return ((midi % 12) + 12) % 12;
}

/** H-system name (Finnish/German): H = B natural, B = B flat, -is sharps, -es flats. */
export function hSystemName(step, alter = 0) {
	if (step === "B") return alter === 0 ? "H" : alter === -1 ? "B" : "His";
	if (alter === 1) return `${step}is`;
	if (alter === -1) return step === "E" ? "Es" : step === "A" ? "As" : `${step}es`;
	return step;
}

export function letterName(step, alter = 0) {
	return step + (alter === 1 ? "♯" : alter === -1 ? "♭" : "");
}

/** Short display name in the locale's naming system. */
export function noteName(step, alter, noteNames) {
	return noteNames === "h-system" ? hSystemName(step, alter) : letterName(step, alter);
}

/** Stable ASCII key used in stored progress: "C4", "F#4", "Bb3"; pitch class when octave is null. */
export function noteKey(step, alter, octave) {
	return step + (alter === 1 ? "#" : alter === -1 ? "b" : "") + (octave ?? "");
}

const KEY_RE = /^([A-G])(#|b)?(\d)?$/;

export function parseNoteKey(key) {
	const m = KEY_RE.exec(key);
	if (!m) return null;
	return { step: m[1], alter: m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0, octave: m[3] === undefined ? null : Number(m[3]) };
}

export function isNoteKey(key) {
	return KEY_RE.test(key);
}

/** Spell a MIDI number; black keys as sharps unless prefer === "flat". */
export function spellMidi(midi, prefer = "sharp") {
	const pc = pitchClass(midi);
	const octave = Math.floor(midi / 12) - 1;
	const sharp = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
	const flat = ["C", "D", "D", "E", "E", "F", "G", "G", "A", "A", "B", "B"];
	const black = [1, 3, 6, 8, 10].includes(pc);
	if (!black) return { step: sharp[pc], alter: 0, octave };
	return prefer === "flat" ? { step: flat[pc], alter: -1, octave } : { step: sharp[pc], alter: 1, octave };
}

export function isBlackKey(midi) {
	return [1, 3, 6, 8, 10].includes(pitchClass(midi));
}

/** "C4" style label with scientific octave, in the locale's naming system. */
export function midiLabel(midi, noteNames) {
	const n = spellMidi(midi);
	return `${noteName(n.step, n.alter, noteNames)}${n.octave}`;
}

/** Both spellings of a black key, e.g. "C♯/D♭" or "Cis/Des". */
export function blackKeyName(midi, noteNames) {
	const s = spellMidi(midi, "sharp");
	const f = spellMidi(midi, "flat");
	return `${noteName(s.step, s.alter, noteNames)}/${noteName(f.step, f.alter, noteNames)}`;
}

/** White-key notes from `from` to `to` inclusive, e.g. whiteRange("C4", "G4"). */
export function whiteRange(from, to) {
	const a = parseNoteKey(from);
	const b = parseNoteKey(to);
	const out = [];
	for (let d = diatonic(a); d <= diatonic(b); d++) out.push({ step: STEPS[d % 7], alter: 0, octave: Math.floor(d / 7) });
	return out;
}
