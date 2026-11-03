// Suggested right-hand fingering for a melody (1 = thumb ... 5 = little finger). Pure.
//
// Five-finger positions: the hand covers five neighbouring white keys (a black key takes the
// finger of the white key it is written on, F sharp = F). A small dynamic program chooses the
// position for every note over the whole melody: each move of the hand costs a little, and
// the same finger on two different notes in a row, or a thumb crossing, costs more, unless the
// notes are more than five white keys apart (the hand has to jump there anyway). That is how
// beginner pieces are fingered; thumb crossings are never chosen on purpose, so the result is
// shown as a suggestion only.
import { diatonic } from "./notes.js";

const MOVE = 1;
const MOVE_PER_KEY = 0.05;
const SAME_FINGER = 2;
// Going up with a lower finger (or down with a higher one) means crossing the thumb.
const CROSSING = 1.5;

/** notes: [{ step, alter, octave }] in playing order (one per step). Returns finger numbers. */
export function suggestFingers(notes) {
	const d = notes.map((n) => diatonic(n));
	if (!d.length) return [];
	// table[i]: Map base -> { cost, from } where base = the white key under the thumb.
	const table = [];
	for (let i = 0; i < d.length; i++) {
		const row = new Map();
		for (let base = d[i] - 4; base <= d[i]; base++) {
			let best = null;
			if (i === 0) best = { cost: 0, from: null };
			else {
				for (const [prevBase, prev] of table[i - 1]) {
					let cost = prev.cost;
					if (prevBase !== base) cost += MOVE + MOVE_PER_KEY * Math.abs(prevBase - base);
					const finger = d[i] - base;
					const prevFinger = d[i - 1] - prevBase;
					const leap = Math.abs(d[i] - d[i - 1]) > 4;
					if (!leap && d[i] !== d[i - 1] && finger === prevFinger) cost += SAME_FINGER;
					if (!leap && ((d[i] > d[i - 1] && finger < prevFinger) || (d[i] < d[i - 1] && finger > prevFinger))) cost += CROSSING;
					if (!best || cost < best.cost) best = { cost, from: prevBase };
				}
			}
			row.set(base, best);
		}
		table.push(row);
	}
	let base = [...table[d.length - 1]].reduce((a, b) => (b[1].cost < a[1].cost ? b : a))[0];
	const out = new Array(d.length);
	for (let i = d.length - 1; i >= 0; i--) {
		out[i] = d[i] - base + 1;
		base = table[i].get(base).from;
	}
	return out;
}
