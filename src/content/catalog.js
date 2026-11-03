// Language-neutral course content: lesson ids, note pools, examples, rhythm drills and
// built-in pieces. Every human-readable word lives in src/content/locales/<lang>.js.
//
// Ids are stable contracts: stored progress and sync data use them. Never rename an id;
// add a new one and keep the old one if a lesson changes meaning. See docs/adding-lessons.md.
import { STEPS, whiteRange } from "../core/notes.js";

export const UNLOCK_PCT = 90;
export const ROUND_SIZE = 20;
export const ROW_LENGTH = 8;

export const KEY_SIGS = {
	G: { fifths: 1, alters: { F: 1 } },
	F: { fifths: -1, alters: { B: -1 } },
	D: { fifths: 2, alters: { F: 1, C: 1 } },
};

const onClef = (clef) => (n) => ({ ...n, clef, written: null });
const byMiddleC = (n) => ({ ...n, clef: n.octave >= 4 ? "treble" : "bass", written: null });

/**
 * Pitch lessons in teaching order.
 * staff: "treble" | "bass" | "grand" | null (key-name lesson, no staff)
 * pool(keySig) -> notes drilled; example() -> notes shown with names on the guide page;
 * highlight: pitch classes marked on the keyboard in the guide (key-name lesson).
 * modes: which exercise modes the lesson offers.
 */
export const PITCH_LESSONS = [
	{
		id: "keys",
		staff: null,
		modes: ["single", "ear"],
		highlight: [0, 5],
		range: ["C3", "B5"],
		pool: () => STEPS.map((step) => ({ step, alter: 0, octave: null, clef: null, written: null })),
	},
	{
		id: "treble-c4-g4",
		staff: "treble",
		modes: ["single", "row", "ear"],
		range: ["C3", "B5"],
		pool: () => whiteRange("C4", "G4").map(onClef("treble")),
	},
	{
		id: "treble-c4-c5",
		staff: "treble",
		modes: ["single", "row", "ear"],
		range: ["C3", "B5"],
		pool: () => whiteRange("C4", "C5").map(onClef("treble")),
	},
	{
		id: "treble-c4-g5",
		staff: "treble",
		modes: ["single", "row", "ear"],
		range: ["C4", "B6"],
		pool: () => whiteRange("C4", "G5").map(onClef("treble")),
		example: () => whiteRange("E4", "G5").map(onClef("treble")),
	},
	{
		id: "bass-c3-c4",
		staff: "bass",
		modes: ["single", "row", "ear"],
		range: ["C2", "B4"],
		pool: () => whiteRange("C3", "C4").map(onClef("bass")),
	},
	{
		id: "bass-f2-c4",
		staff: "bass",
		modes: ["single", "row", "ear"],
		range: ["C2", "B4"],
		pool: () => whiteRange("F2", "C4").map(onClef("bass")),
		example: () => whiteRange("F2", "B3").map(onClef("bass")),
	},
	{
		id: "grand",
		staff: "grand",
		modes: ["single", "row", "ear"],
		range: ["C2", "B5"],
		pool: () => whiteRange("F2", "G5").map(byMiddleC),
		example: () => [...whiteRange("C3", "B3").map(onClef("bass")), ...whiteRange("C4", "C5").map(onClef("treble"))],
	},
	{
		id: "ledger",
		staff: "grand",
		modes: ["single", "row"],
		range: ["C2", "B6"],
		pool: () => [
			...whiteRange("A5", "E6").map(onClef("treble")),
			...whiteRange("A3", "C4").map(onClef("treble")),
			...whiteRange("C2", "F2").map(onClef("bass")),
			...whiteRange("C4", "E4").map(onClef("bass")),
		],
		example: () => [
			...whiteRange("A3", "C4").map(onClef("treble")),
			...whiteRange("A5", "C6").map(onClef("treble")),
			...whiteRange("C2", "E2").reverse().map(onClef("bass")),
		],
	},
	{
		id: "accidentals",
		staff: "treble",
		modes: ["single", "row"],
		range: ["C3", "B5"],
		pool: () => {
			const out = whiteRange("C4", "C5").map(onClef("treble"));
			for (const n of whiteRange("C4", "B4")) {
				if (n.step !== "E" && n.step !== "B") out.push({ ...n, alter: 1, clef: "treble", written: 1 });
				if (n.step !== "C" && n.step !== "F") out.push({ ...n, alter: -1, clef: "treble", written: -1 });
			}
			return out;
		},
		example: () => [
			{ step: "F", alter: 0, octave: 4, clef: "treble", written: null },
			{ step: "F", alter: 1, octave: 4, clef: "treble", written: 1 },
			{ step: "G", alter: -1, octave: 4, clef: "treble", written: -1 },
			{ step: "E", alter: 0, octave: 4, clef: "treble", written: null },
			{ step: "E", alter: -1, octave: 4, clef: "treble", written: -1 },
			{ step: "B", alter: -1, octave: 4, clef: "treble", written: -1 },
		],
	},
	{
		id: "keysig",
		staff: "treble",
		modes: ["single", "row"],
		range: ["C3", "B5"],
		keySigs: ["G", "F", "D"],
		exampleKeySig: "G",
		pool: (keySig) => {
			const alters = KEY_SIGS[keySig]?.alters ?? {};
			return whiteRange("C4", "C5").map((n) => ({ ...n, alter: alters[n.step] ?? 0, clef: "treble", written: null }));
		},
		example: () => whiteRange("C4", "C5").map((n) => ({ ...n, alter: n.step === "F" ? 1 : 0, clef: "treble", written: null })),
	},
];

/**
 * Rhythm lessons. Quizzes are untimed (the conforming alternative for timing-based play);
 * "tap" plays patterns against a metronome and is optional.
 */
export const RHYTHM_LESSONS = [
	{
		id: "rhythm-values",
		kind: "quiz",
		modes: ["quiz"],
		// value -> beats in 4/4
		items: [
			{ value: "w", beats: 4 },
			{ value: "hd", beats: 3 },
			{ value: "h", beats: 2 },
			{ value: "q", beats: 1 },
			{ value: "e", beats: 0.5 },
		],
		answers: [4, 3, 2, 1, 0.5],
	},
	{
		id: "rhythm-rests",
		kind: "quiz",
		modes: ["quiz"],
		items: [
			{ rest: true, value: "w", beats: 4 },
			{ rest: true, value: "h", beats: 2 },
			{ rest: true, value: "q", beats: 1 },
			{ rest: true, value: "e", beats: 0.5 },
		],
		answers: [4, 2, 1, 0.5],
	},
	{
		id: "rhythm-meter",
		kind: "meter",
		modes: ["quiz"],
		// Bars with one or more beats missing; the answer is beats missing.
		bars: [
			{ time: [4, 4], melody: "B4h B4q", missing: 1 },
			{ time: [4, 4], melody: "B4q B4q", missing: 2 },
			{ time: [4, 4], melody: "B4q", missing: 3 },
			{ time: [4, 4], melody: "B4hd", missing: 1 },
			{ time: [4, 4], melody: "B4e B4e B4q", missing: 2 },
			{ time: [3, 4], melody: "B4q B4q", missing: 1 },
			{ time: [3, 4], melody: "B4q", missing: 2 },
			{ time: [3, 4], melody: "B4e B4e B4q", missing: 1 },
			{ time: [4, 4], melody: "B4q B4e B4e B4q", missing: 1 },
			{ time: [3, 4], melody: "B4h", missing: 1 },
		],
		answers: [1, 2, 3],
	},
	{
		id: "rhythm-play",
		kind: "tap",
		modes: ["tap"],
		patterns: [
			"B4q B4q B4q B4q",
			"B4h B4h",
			"B4h B4q B4q",
			"B4q B4q B4h",
			"B4w",
			"B4hd B4q",
			"B4e B4e B4q B4q B4q",
			"B4q B4e B4e B4h",
			"B4q rq B4q rq",
			"B4e B4e B4e B4e B4h",
		],
	},
];

/**
 * Built-in pieces: our own transcriptions of public-domain melodies, MIT licensed.
 * right/left use the compact notation in src/core/notation.js. Titles and descriptions are
 * in the locale files (pieces.<id>). lesson = the lesson that covers the notes used.
 */
export const PIECES = [
	{
		id: "ukko-nooa",
		composer: "Carl Michael Bellman (trad.)",
		level: 1,
		lesson: "treble-c4-g4",
		fifths: 0,
		time: [4, 4],
		right: "C4q C4q C4q E4q | D4q D4q D4q F4q | E4q E4q D4q D4q | C4w | E4q E4q E4q E4q | G4h F4h | D4q D4q D4q D4q | F4h E4h | C4q C4q C4q E4q | D4q D4q D4q F4q | E4q E4q D4q D4q | C4w",
	},
	{
		id: "tuiki-tuiki",
		composer: "Traditional (Ah! vous dirai-je, maman)",
		level: 1,
		lesson: "treble-c4-c5",
		fifths: 0,
		time: [4, 4],
		right: "C4q C4q G4q G4q | A4q A4q G4h | F4q F4q E4q E4q | D4q D4q C4h | G4q G4q F4q F4q | E4q E4q D4h | G4q G4q F4q F4q | E4q E4q D4h | C4q C4q G4q G4q | A4q A4q G4h | F4q F4q E4q E4q | D4q D4q C4h",
	},
	{
		id: "maijalla-oli-karitsa",
		composer: "Traditional (Mary Had a Little Lamb)",
		level: 1,
		lesson: "treble-c4-g4",
		fifths: 0,
		time: [4, 4],
		right: "E4q D4q C4q D4q | E4q E4q E4h | D4q D4q D4h | E4q G4q G4h | E4q D4q C4q D4q | E4q E4q E4q E4q | D4q D4q E4q D4q | C4w",
	},
	{
		id: "jaakko-kulta",
		composer: "Traditional (Frère Jacques)",
		level: 2,
		lesson: "treble-c4-c5",
		fifths: 0,
		time: [4, 4],
		right: "C4q D4q E4q C4q | C4q D4q E4q C4q | E4q F4q G4h | E4q F4q G4h | G4e A4e G4e F4e E4q C4q | G4e A4e G4e F4e E4q C4q | C4q G3q C4h | C4q G3q C4h",
	},
	{
		id: "oodi-ilolle",
		composer: "Ludwig van Beethoven",
		level: 2,
		lesson: "treble-c4-g4",
		fifths: 0,
		time: [4, 4],
		right: "E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | E4qd D4e D4h | E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | D4qd C4e C4h",
	},
	{
		id: "menuetti-g",
		composer: "Christian Petzold (BWV Anh. 114)",
		level: 3,
		lesson: "keysig",
		fifths: 1,
		time: [3, 4],
		right: "D5q G4e A4e B4e C5e | D5q G4q G4q | E5q C5e D5e E5e F#5e | G5q G4q G4q | C5q D5e C5e B4e A4e | B4q C5e B4e A4e G4e | F#4q G4e A4e B4e G4e | A4hd",
	},
];

export const CATALOG_IDS = {
	lessons: PITCH_LESSONS.map((l) => l.id),
	rhythm: RHYTHM_LESSONS.map((l) => l.id),
	pieces: PIECES.map((p) => p.id),
};

/** Key-signature alterations for a number of fifths (-1 = F major, 1 = G major, 2 = D major). */
export function altersFor(fifths) {
	const sharps = ["F", "C", "G", "D", "A", "E", "B"];
	const flats = ["B", "E", "A", "D", "G", "C", "F"];
	const out = {};
	if (fifths > 0) for (const s of sharps.slice(0, fifths)) out[s] = 1;
	if (fifths < 0) for (const s of flats.slice(0, -fifths)) out[s] = -1;
	return out;
}
