// Short practice phrases: two bars of 4/4 that move mostly by step, start and end on the key
// note (tonic) and grow harder by level. They are read and played like a note row. Pure; the
// random source can be passed in, so the tests can check many phrases of every level.

const STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const KEYS = { C: {}, G: { F: 1 }, F: { B: -1 } };

/**
 * Levels: range (lowest and highest note), the largest move in letter steps (1 = second,
 * 2 = third, 3 = fourth, 4 = fifth), the rhythms and keys used.
 */
export const PHRASE_LEVELS = {
	1: { ranges: { treble: ["C4", "G4"] }, maxMove: 1, halves: false, keys: ["C"] },
	2: { ranges: { treble: ["C4", "C5"] }, maxMove: 2, halves: true, keys: ["C"] },
	3: { ranges: { treble: ["C4", "G5"], bass: ["C3", "C4"] }, maxMove: 3, halves: true, keys: ["C"] },
	4: { ranges: { grand: ["F3", "G5"] }, maxMove: 4, halves: true, keys: ["C", "G", "F"] },
};

// Rhythms of one 4/4 bar; a phrase ends with a held note.
const BARS = [["q", "q", "q", "q"], ["q", "q", "h"], ["h", "q", "q"], ["q", "h", "q"], ["h", "h"]];
const LAST_BARS = [["q", "q", "h"], ["h", "h"], ["w"]];

const indexOf = (key) => STEPS.indexOf(key[0]) + Number(key.slice(-1)) * 7;

function noteAt(index, alters, clef) {
	const step = STEPS[index % 7];
	const octave = Math.floor(index / 7);
	const alter = alters[step] ?? 0;
	const midi = (octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][index % 7] + alter;
	return { step, alter, octave, clef: clef === "grand" ? (midi >= 60 ? "treble" : "bass") : clef, written: null, midi };
}

function pick(list, rng) {
	return list[Math.floor(rng() * list.length)];
}

/** Values (w, h, q) of a phrase: two bars, quarters only on level 1. */
export function phraseRhythm(level, rng = Math.random) {
	if (!PHRASE_LEVELS[level].halves) return ["q", "q", "q", "q", "q", "q", "q", "q"];
	return [...pick(BARS, rng), ...pick(LAST_BARS, rng)];
}

/**
 * A phrase: { key, clef, notes: [{ step, alter, octave, clef, written, midi, value }] }.
 * Moves: steps are most common, larger moves (up to the level's limit) less so; repeated
 * notes only on level 1. The first and last note are the key note.
 */
export function generatePhrase({ level, clef = null, key = null, rng = Math.random }) {
	const cfg = PHRASE_LEVELS[level];
	const staff = clef && cfg.ranges[clef] ? clef : Object.keys(cfg.ranges)[0];
	const k = key && cfg.keys.includes(key) ? key : pick(cfg.keys, rng);
	const [lo, hi] = cfg.ranges[staff].map(indexOf);
	const tonics = [];
	for (let i = lo; i <= hi; i++) if (STEPS[i % 7] === k) tonics.push(i);
	const values = phraseRhythm(level, rng);
	for (let attempt = 0; attempt < 500; attempt++) {
		let cur = pick(tonics, rng);
		const seq = [cur];
		for (let i = 1; i < values.length - 1; i++) {
			const moves = [];
			for (let d = -cfg.maxMove; d <= cfg.maxMove; d++) {
				if (d === 0 && level > 1) continue;
				if (cur + d < lo || cur + d > hi) continue;
				// Weights: steps 4, thirds 2, larger moves and repeats 1.
				const w = Math.abs(d) === 1 ? 4 : Math.abs(d) === 2 ? 2 : 1;
				for (let n = 0; n < w; n++) moves.push(d);
			}
			cur += pick(moves, rng);
			seq.push(cur);
		}
		const ends = tonics.filter((t) => Math.abs(t - cur) <= cfg.maxMove && (t !== cur || level === 1));
		if (!ends.length) continue;
		seq.push(ends.sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur))[0]);
		return { key: k, clef: staff, notes: seq.map((i, n) => ({ ...noteAt(i, KEYS[k], staff), value: values[n] })) };
	}
	throw new Error(`no phrase for level ${level}`);
}

/** Every note a level can use (all its keys), for the drill's note pool and weak-note list. */
export function phrasePool(level, clef = null) {
	const cfg = PHRASE_LEVELS[level];
	const staff = clef && cfg.ranges[clef] ? clef : Object.keys(cfg.ranges)[0];
	const [lo, hi] = cfg.ranges[staff].map(indexOf);
	const seen = new Map();
	for (const k of cfg.keys)
		for (let i = lo; i <= hi; i++) {
			const n = noteAt(i, KEYS[k], staff);
			seen.set(`${n.step}${n.alter}${n.octave}`, n);
		}
	return [...seen.values()];
}
