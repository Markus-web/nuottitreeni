// Practice phrases (src/core/phrases.js): many phrases of every level stay in range, move no
// further than the level allows, fill two bars and start and end on the key note.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BEATS } from "../../src/core/notation.js";
import { midiOf } from "../../src/core/notes.js";
import { PHRASE_LEVELS, generatePhrase, phrasePool } from "../../src/core/phrases.js";

function seeded(seed) {
	let s = seed;
	const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
	// The first values of a small seed are all near 0; skip them.
	for (let i = 0; i < 5; i++) next();
	return next;
}
const STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const index = (n) => STEPS.indexOf(n.step) + n.octave * 7;
const SIG = { C: {}, G: { F: 1 }, F: { B: -1 } };

test("phrases follow their level's rules", () => {
	for (const level of [1, 2, 3, 4]) {
		const cfg = PHRASE_LEVELS[level];
		for (const clef of Object.keys(cfg.ranges)) {
			const [lo, hi] = cfg.ranges[clef].map((k) => STEPS.indexOf(k[0]) + Number(k.slice(-1)) * 7);
			for (let seed = 1; seed <= 200; seed++) {
				const p = generatePhrase({ level, clef, rng: seeded(seed) });
				const where = `level ${level} ${clef} seed ${seed}`;
				const beats = p.notes.reduce((a, n) => a + BEATS[n.value], 0);
				assert.equal(beats, 8, `${where}: two full bars of 4/4`);
				let bar = 0;
				for (const n of p.notes) {
					assert.ok(bar % 4 + BEATS[n.value] <= 4, `${where}: no note crosses a bar line`);
					bar += BEATS[n.value];
				}
				assert.equal(p.notes[0].step, p.key, `${where}: starts on the key note`);
				assert.equal(p.notes.at(-1).step, p.key, `${where}: ends on the key note`);
				p.notes.forEach((n, i) => {
					assert.ok(index(n) >= lo && index(n) <= hi, `${where}: note ${i + 1} in range`);
					assert.equal(n.alter, SIG[p.key][n.step] ?? 0, `${where}: note ${i + 1} follows the key`);
					assert.equal(n.midi, midiOf(n));
					assert.equal(n.clef, clef === "grand" ? (n.midi >= 60 ? "treble" : "bass") : clef);
					if (i) {
						const move = Math.abs(index(n) - index(p.notes[i - 1]));
						assert.ok(move <= cfg.maxMove, `${where}: move ${move} within ${cfg.maxMove}`);
						if (level > 1) assert.ok(move > 0, `${where}: no repeated notes above level 1`);
					}
				});
				if (!cfg.halves) assert.ok(p.notes.every((n) => n.value === "q"), `${where}: quarters only`);
			}
		}
	}
});

test("level 4 uses C, G and F major", () => {
	const keys = new Set();
	for (let seed = 1; seed <= 60; seed++) keys.add(generatePhrase({ level: 4, rng: seeded(seed) }).key);
	assert.deepEqual([...keys].sort(), ["C", "F", "G"]);
	assert.equal(generatePhrase({ level: 4, key: "G", rng: seeded(3) }).key, "G");
});

test("the pool holds every note a level can use", () => {
	const pool = phrasePool(4);
	assert.ok(pool.some((n) => n.step === "F" && n.alter === 1) && pool.some((n) => n.step === "F" && n.alter === 0) && pool.some((n) => n.step === "B" && n.alter === -1));
	for (let seed = 1; seed <= 50; seed++)
		for (const n of generatePhrase({ level: 4, rng: seeded(seed) }).notes) assert.ok(pool.some((p) => p.step === n.step && p.alter === n.alter && p.octave === n.octave), `${n.step}${n.octave} in the pool`);
});
