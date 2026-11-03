import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG_IDS } from "../../src/content/catalog.js";
import { LIMITS, addPractice, aggregate, emptyProgress, mergeProgress, practiceSummary, pruneDevices, recordPiece, recordRound, validateProgress } from "../../src/core/progress.js";

const DEV_A = "aaaaaaaaaaaaaaaaaaaaaaaaaa";
const DEV_B = "bbbbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = Date.UTC(2026, 10, 3, 12);

function sample() {
	let doc = emptyProgress();
	doc = recordRound(doc, DEV_A, { kind: "lesson", id: "treble-c4-g4", mode: "single", accuracy: 85, results: [{ key: "C4", ok: true, ms: 900 }, { key: "D4", ok: false, ms: 2500 }] }, NOW);
	doc = recordRound(doc, DEV_A, { kind: "rhythm", id: "rhythm-values", mode: "quiz", accuracy: 100 }, NOW + 1);
	doc = recordPiece(doc, DEV_A, { id: "ukko-nooa", wrong: 3 }, NOW + 2);
	doc = addPractice(doc, DEV_A, "2026-11-03", 600, NOW + 3);
	return doc;
}

test("a recorded document validates", () => {
	const r = validateProgress(sample(), CATALOG_IDS);
	assert.deepEqual(r.errors, []);
	assert.equal(r.ok, true);
});

test("validation rejects unknown ids, modes, fields and bad values", () => {
	const bad = (mutate) => {
		const d = sample();
		mutate(d);
		return validateProgress(d, CATALOG_IDS).ok;
	};
	assert.equal(bad((d) => (d.devices[DEV_A].lessons["made-up"] = {})), false);
	assert.equal(bad((d) => (d.devices[DEV_A].lessons["treble-c4-g4"].dance = d.devices[DEV_A].lessons["treble-c4-g4"].single)), false);
	assert.equal(bad((d) => (d.devices[DEV_A].lessons["treble-c4-g4"].single.best = 101)), false);
	assert.equal(bad((d) => (d.devices[DEV_A].lessons["treble-c4-g4"].single.notes["X9"] = { a: 1, w: 0, t: [] })), false);
	assert.equal(bad((d) => (d.devices[DEV_A].lessons["treble-c4-g4"].single.notes.C4.w = 99)), false);
	assert.equal(bad((d) => (d.devices[DEV_A].name = "Markus")), false);
	assert.equal(bad((d) => (d.extra = 1)), false);
	assert.equal(bad((d) => (d.devices["Not An Id"] = d.devices[DEV_A])), false);
	assert.equal(bad((d) => (d.devices[DEV_A].practice["yesterday"] = 5)), false);
	assert.equal(bad((d) => (d.devices[DEV_A].pieces["unknown-piece"] = { runs: 1, best: 0, lastAt: 0 })), false);
	assert.equal(bad((d) => (d.v = 2)), false);
	assert.equal(validateProgress(null, CATALOG_IDS).ok, false);
});

test("validation enforces the device limit and the size cap", () => {
	const d = sample();
	for (let i = 0; i < LIMITS.devices; i++) d.devices[`dev${String(i).padStart(10, "0")}`] = structuredClone(d.devices[DEV_A]);
	assert.equal(validateProgress(d, CATALOG_IDS).ok, false);
	const big = sample();
	big.devices[DEV_A].practice = {};
	for (let i = 0; i < 400; i++) big.devices[DEV_A].practice[`2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`] = 60;
	assert.ok(validateProgress(big, CATALOG_IDS).ok);
});

test("merge unions devices and never double counts", () => {
	const a = sample();
	let b = recordRound(emptyProgress(), DEV_B, { kind: "lesson", id: "treble-c4-g4", mode: "single", accuracy: 95, results: [{ key: "C4", ok: true, ms: 700 }] }, NOW + 10);
	const merged = mergeProgress(a, b);
	assert.deepEqual(Object.keys(merged.devices).sort(), [DEV_A, DEV_B]);
	const twice = mergeProgress(merged, merged);
	const agg = aggregate(twice);
	assert.equal(agg.lessons["treble-c4-g4"].single.rounds, 2);
	assert.equal(agg.lessons["treble-c4-g4"].single.best, 95);
	assert.equal(agg.lessons["treble-c4-g4"].single.notes.C4.a, 2);
	b = recordRound(b, DEV_B, { kind: "lesson", id: "treble-c4-g4", mode: "single", accuracy: 60, results: [] }, NOW + 20);
	const newer = mergeProgress(merged, b);
	assert.equal(newer.devices[DEV_B].lessons["treble-c4-g4"].single.rounds, 2, "newer device section wins");
});

test("per-note times are capped and medians computed", () => {
	let d = emptyProgress();
	for (let i = 0; i < 15; i++) d = recordRound(d, DEV_A, { kind: "lesson", id: "keys", mode: "single", accuracy: 100, results: [{ key: "C", ok: true, ms: 1000 + i }] }, NOW + i);
	assert.equal(d.devices[DEV_A].lessons.keys.single.notes.C.t.length, LIMITS.timesPerNote);
	assert.equal(aggregate(d).lessons.keys.single.notes.C.medianMs, 1010);
	assert.ok(validateProgress(d, CATALOG_IDS).ok);
});

test("pieces keep the fewest wrong notes; pruning keeps the newest devices", () => {
	let d = recordPiece(emptyProgress(), DEV_A, { id: "ukko-nooa", wrong: 5 }, NOW);
	d = recordPiece(d, DEV_A, { id: "ukko-nooa", wrong: 2 }, NOW + 1);
	d = recordPiece(d, DEV_A, { id: "ukko-nooa", wrong: 4 }, NOW + 2);
	assert.equal(d.devices[DEV_A].pieces["ukko-nooa"].best, 2);
	const many = { v: 1, devices: {} };
	for (let i = 0; i < 12; i++) many.devices[`dev${String(i).padStart(10, "0")}`] = { updatedAt: i, lessons: {}, rhythm: {}, pieces: {}, practice: {} };
	const pruned = pruneDevices(many);
	assert.equal(Object.keys(pruned.devices).length, LIMITS.devices);
	assert.ok(!pruned.devices.dev0000000000, "oldest dropped");
});

test("practice summary: today, week, streak", () => {
	const day = (offset) => {
		const d = new Date(NOW - offset * 86400000);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	};
	const practice = { [day(0)]: 600, [day(1)]: 300, [day(2)]: 120, [day(4)]: 60 };
	assert.deepEqual(practiceSummary(practice, NOW), { todaySec: 600, weekSec: 1080, streak: 3 });
	assert.equal(practiceSummary({ [day(1)]: 60 }, NOW).streak, 1, "no practice yet today keeps yesterday's streak");
});
