// Names for what is played at once in the note explorer: the interval between two notes and
// common chords (triads in any inversion, three seventh chords). Played notes have no spelling,
// so intervals are named by sound (C to D sharp is a minor third). Pure; the page turns the
// result into text with the locale strings (chords.*).

/** Semitones within an octave -> interval key (locale chords.intervals.<key>). */
export const INTERVALS = ["unison", "minor2", "major2", "minor3", "major3", "perfect4", "tritone", "perfect5", "minor6", "major6", "minor7", "major7", "octave"];

/** Chord shapes as semitones above the root; the order of the notes after the root is root, third, fifth, seventh. */
const SHAPES = {
	major: [0, 4, 7],
	minor: [0, 3, 7],
	diminished: [0, 3, 6],
	augmented: [0, 4, 8],
	dominant7: [0, 4, 7, 10],
	major7: [0, 4, 7, 11],
	minor7: [0, 3, 7, 10],
};

/**
 * Interval between two MIDI notes: { key, octaves } where key is from INTERVALS and octaves
 * counts whole octaves above the simple interval (a tenth is a third plus one octave).
 */
export function nameInterval(a, b) {
	const d = Math.abs(b - a);
	if (d === 0) return { key: "unison", octaves: 0 };
	if (d % 12 === 0) return { key: "octave", octaves: d / 12 - 1 };
	return { key: INTERVALS[d % 12], octaves: Math.floor(d / 12) };
}

/**
 * Chord of three or more MIDI notes: { root (pitch class 0-11), quality, inversion } or null.
 * inversion 0 = root position (the root is the lowest note), 1 = the third is lowest, and so on.
 * The augmented triad has no single root by sound; its lowest note is taken as the root.
 */
export function nameChord(midis) {
	const sorted = [...new Set(midis)].sort((x, y) => x - y);
	const classes = [...new Set(sorted.map((m) => m % 12))];
	if (classes.length < 3) return null;
	const bass = sorted[0] % 12;
	const roots = [bass, ...classes.filter((c) => c !== bass)];
	for (const root of roots) {
		const rel = classes.map((c) => (c - root + 12) % 12).sort((x, y) => x - y);
		for (const [quality, shape] of Object.entries(SHAPES)) {
			if (shape.length === rel.length && shape.every((s, i) => s === rel[i])) {
				const inversion = shape.indexOf((bass - root + 12) % 12);
				return { root, quality, inversion };
			}
		}
	}
	return null;
}
