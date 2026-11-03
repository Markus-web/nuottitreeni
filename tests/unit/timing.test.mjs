// Timing judgment and piece scores (src/core/timing.js).
import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeTiming, pieceScore } from "../../src/core/timing.js";

const opts = { window: 80, reach: 250 };

test("on time, early, late and missed", () => {
	const expected = [{ at: 0 }, { at: 500 }, { at: 1000 }, { at: 1500 }];
	const hits = [{ at: 30 }, { at: 380 }, { at: 1150 }];
	const r = judgeTiming(expected, hits, opts);
	assert.deepEqual(r.results, ["onTime", "early", "late", "missed"]);
	assert.deepEqual(r.counts, { onTime: 1, early: 1, late: 1, missed: 1 });
	assert.equal(r.wrong, 0);
});

test("a hit is used once, extra hits are wrong, and the longest streak is counted", () => {
	const expected = [0, 500, 1000, 1500, 2000].map((at) => ({ at }));
	const hits = [{ at: 5 }, { at: 10 }, { at: 495 }, { at: 1004 }, { at: 1800 }, { at: 2010 }];
	const r = judgeTiming(expected, hits, opts);
	assert.deepEqual(r.results, ["onTime", "onTime", "onTime", "missed", "onTime"]);
	assert.equal(r.longestStreak, 3);
	assert.equal(r.wrong, 2, "the second hit near 0 ms and the one at 1800 ms");
});

test("with keys, only the same key matches", () => {
	const expected = [{ at: 0, midi: 60 }, { at: 500, midi: 62 }];
	const hits = [{ at: 0, midi: 61 }, { at: 500, midi: 62 }];
	const r = judgeTiming(expected, hits, opts);
	assert.deepEqual(r.results, ["missed", "onTime"]);
	assert.equal(r.wrong, 1);
});

test("piece scores", () => {
	assert.equal(pieceScore({ mode: "wait", notes: 30, wrong: 0 }), 100);
	assert.equal(pieceScore({ mode: "wait", notes: 30, wrong: 10 }), 75);
	assert.equal(pieceScore({ mode: "tempo", notes: 10, wrong: 0, counts: { onTime: 6, early: 2, late: 2, missed: 0 } }), 80);
	assert.equal(pieceScore({ mode: "tempo", notes: 10, wrong: 4, counts: { onTime: 6, early: 0, late: 0, missed: 4 } }), 40);
	assert.equal(pieceScore({ mode: "tempo", notes: 4, wrong: 20, counts: { onTime: 1, early: 0, late: 0, missed: 3 } }), 0, "never below 0");
	assert.equal(pieceScore({ mode: "wait", notes: 0 }), 0);
});
