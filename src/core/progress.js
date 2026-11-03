// Progress document v1: the only data that sync ever stores. Shared by the browser and the
// Worker, so validation is identical on both sides. Pure functions; callers persist.
//
// {
//   v: 1,
//   devices: {
//     <deviceId>: {
//       updatedAt: ms,
//       lessons: { <lessonId>: { <mode>: { rounds, best, last, lastAt, notes: { <noteKey>: { a, w, t: [ms...] } } } } },
//       rhythm:  { <rhythmId>: { <mode>: { rounds, best, last, lastAt } } },
//       pieces:  { <pieceId>: { runs, best, lastAt } },
//       practice: { "YYYY-MM-DD": seconds }
//     }
//   }
// }
//
// Each device writes only its own section, so merging never double counts: the union of
// devices, and for the same device the section with the newer updatedAt wins.
import { isNoteKey } from "./notes.js";

export const LIMITS = {
	bytes: 64 * 1024,
	devices: 8,
	practiceDays: 400,
	timesPerNote: 10,
	notesPerMode: 64,
	maxCount: 1_000_000,
	maxMs: 600_000,
};
export const LESSON_MODES = ["single", "row", "ear", "name"];
export const RHYTHM_MODES = ["quiz", "tap"];
const DEVICE_RE = /^[a-z0-9]{8,40}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyProgress() {
	return { v: 1, devices: {} };
}

export function emptyDevice(now = 0) {
	return { updatedAt: now, lessons: {}, rhythm: {}, pieces: {}, practice: {} };
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isInt = (v, max = LIMITS.maxCount) => Number.isInteger(v) && v >= 0 && v <= max;
const isPct = (v) => Number.isInteger(v) && v >= 0 && v <= 100;
const isTs = (v) => Number.isInteger(v) && v >= 0 && v <= 8_640_000_000_000_000;

function onlyKeys(obj, allowed, path, errors) {
	for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${path}: unknown field ${k}`);
}

function checkStats(s, path, errors, withNotes) {
	if (!isObj(s)) return errors.push(`${path}: not an object`);
	onlyKeys(s, withNotes ? ["rounds", "best", "last", "lastAt", "notes"] : ["rounds", "best", "last", "lastAt"], path, errors);
	if (!isInt(s.rounds)) errors.push(`${path}.rounds`);
	if (!isPct(s.best)) errors.push(`${path}.best`);
	if (!isPct(s.last)) errors.push(`${path}.last`);
	if (!isTs(s.lastAt)) errors.push(`${path}.lastAt`);
	if (!withNotes) return;
	if (s.notes === undefined) return;
	if (!isObj(s.notes)) return errors.push(`${path}.notes`);
	const keys = Object.keys(s.notes);
	if (keys.length > LIMITS.notesPerMode) errors.push(`${path}.notes: too many`);
	for (const k of keys) {
		const n = s.notes[k];
		const p = `${path}.notes.${k}`;
		if (!isNoteKey(k)) errors.push(`${p}: bad key`);
		if (!isObj(n)) {
			errors.push(`${p}: not an object`);
			continue;
		}
		onlyKeys(n, ["a", "w", "t"], p, errors);
		if (!isInt(n.a)) errors.push(`${p}.a`);
		if (!isInt(n.w) || n.w > n.a) errors.push(`${p}.w`);
		if (!Array.isArray(n.t) || n.t.length > LIMITS.timesPerNote || !n.t.every((t) => isInt(t, LIMITS.maxMs))) errors.push(`${p}.t`);
	}
}

/**
 * Strict validation. `catalog` = { lessons: [ids], rhythm: [ids], pieces: [ids] }.
 * Returns { ok, errors }. Unknown ids, modes and fields are rejected so the sync store
 * can never be used for anything but practice statistics.
 */
export function validateProgress(doc, catalog) {
	const errors = [];
	if (!isObj(doc)) return { ok: false, errors: ["root: not an object"] };
	onlyKeys(doc, ["v", "devices"], "root", errors);
	if (doc.v !== 1) errors.push("v: must be 1");
	if (!isObj(doc.devices)) return { ok: false, errors: [...errors, "devices: not an object"] };
	const ids = Object.keys(doc.devices);
	if (ids.length > LIMITS.devices) errors.push("devices: too many");
	for (const id of ids) {
		const d = doc.devices[id];
		const p = `devices.${id}`;
		if (!DEVICE_RE.test(id)) errors.push(`${p}: bad id`);
		if (!isObj(d)) {
			errors.push(`${p}: not an object`);
			continue;
		}
		onlyKeys(d, ["updatedAt", "lessons", "rhythm", "pieces", "practice"], p, errors);
		if (!isTs(d.updatedAt)) errors.push(`${p}.updatedAt`);
		for (const [field, allowedIds, modes] of [
			["lessons", catalog.lessons, LESSON_MODES],
			["rhythm", catalog.rhythm, RHYTHM_MODES],
		]) {
			if (!isObj(d[field])) {
				errors.push(`${p}.${field}`);
				continue;
			}
			for (const [lid, byMode] of Object.entries(d[field])) {
				if (!allowedIds.includes(lid)) errors.push(`${p}.${field}.${lid}: unknown id`);
				if (!isObj(byMode)) {
					errors.push(`${p}.${field}.${lid}`);
					continue;
				}
				for (const [mode, stats] of Object.entries(byMode)) {
					if (!modes.includes(mode)) errors.push(`${p}.${field}.${lid}.${mode}: unknown mode`);
					else checkStats(stats, `${p}.${field}.${lid}.${mode}`, errors, field === "lessons");
				}
			}
		}
		if (!isObj(d.pieces)) errors.push(`${p}.pieces`);
		else
			for (const [pid, s] of Object.entries(d.pieces)) {
				const pp = `${p}.pieces.${pid}`;
				if (!catalog.pieces.includes(pid)) errors.push(`${pp}: unknown id`);
				if (!isObj(s)) {
					errors.push(pp);
					continue;
				}
				onlyKeys(s, ["runs", "best", "lastAt"], pp, errors);
				if (!isInt(s.runs) || !isInt(s.best) || !isTs(s.lastAt)) errors.push(`${pp}: values`);
			}
		if (!isObj(d.practice)) errors.push(`${p}.practice`);
		else {
			const days = Object.keys(d.practice);
			if (days.length > LIMITS.practiceDays) errors.push(`${p}.practice: too many days`);
			for (const day of days) if (!DAY_RE.test(day) || !isInt(d.practice[day], 86_400)) errors.push(`${p}.practice.${day}`);
		}
	}
	if (errors.length === 0 && byteLength(JSON.stringify(doc)) > LIMITS.bytes) errors.push("size: over 64 KiB");
	return { ok: errors.length === 0, errors };
}

export function byteLength(str) {
	return new TextEncoder().encode(str).length;
}

/** Union of devices; for the same device the newer updatedAt wins (ties keep `a`). */
export function mergeProgress(a, b) {
	const out = emptyProgress();
	for (const src of [a, b]) {
		if (!src?.devices) continue;
		for (const [id, dev] of Object.entries(src.devices)) {
			const cur = out.devices[id];
			if (!cur || (dev.updatedAt ?? 0) > (cur.updatedAt ?? 0)) out.devices[id] = structuredClone(dev);
		}
	}
	return out;
}

/** Keep only the newest `LIMITS.devices` device sections (oldest dropped first). */
export function pruneDevices(doc) {
	const entries = Object.entries(doc.devices).sort((x, y) => (y[1].updatedAt ?? 0) - (x[1].updatedAt ?? 0));
	return { v: 1, devices: Object.fromEntries(entries.slice(0, LIMITS.devices)) };
}

function deviceFor(doc, deviceId, now) {
	const next = structuredClone(doc ?? emptyProgress());
	next.devices[deviceId] ??= emptyDevice(now);
	const dev = next.devices[deviceId];
	dev.updatedAt = Math.max(now, (dev.updatedAt ?? 0) + 1);
	return { next, dev };
}

/**
 * Record a finished round. results: [{ key, ok, ms }] for lesson rounds (per note), omit for rhythm.
 */
export function recordRound(doc, deviceId, { kind, id, mode, accuracy, results = [] }, now) {
	const { next, dev } = deviceFor(doc, deviceId, now);
	const field = kind === "rhythm" ? "rhythm" : "lessons";
	dev[field][id] ??= {};
	const s = (dev[field][id][mode] ??= kind === "rhythm" ? { rounds: 0, best: 0, last: 0, lastAt: 0 } : { rounds: 0, best: 0, last: 0, lastAt: 0, notes: {} });
	s.rounds = Math.min(LIMITS.maxCount, s.rounds + 1);
	s.best = Math.max(s.best, accuracy);
	s.last = accuracy;
	s.lastAt = now;
	if (kind !== "rhythm") {
		for (const r of results) {
			if (!isNoteKey(r.key)) continue;
			const n = (s.notes[r.key] ??= { a: 0, w: 0, t: [] });
			n.a = Math.min(LIMITS.maxCount, n.a + 1);
			if (!r.ok) n.w = Math.min(n.a, n.w + 1);
			n.t.push(Math.min(LIMITS.maxMs, Math.max(0, Math.round(r.ms))));
			if (n.t.length > LIMITS.timesPerNote) n.t.splice(0, n.t.length - LIMITS.timesPerNote);
		}
		// Keep the most-practised notes if a mode ever collects too many keys.
		const keys = Object.keys(s.notes);
		if (keys.length > LIMITS.notesPerMode) {
			keys.sort((x, y) => s.notes[y].a - s.notes[x].a);
			for (const k of keys.slice(LIMITS.notesPerMode)) delete s.notes[k];
		}
	}
	return next;
}

export function recordPiece(doc, deviceId, { id, wrong }, now) {
	const { next, dev } = deviceFor(doc, deviceId, now);
	const s = (dev.pieces[id] ??= { runs: 0, best: wrong, lastAt: 0 });
	s.runs = Math.min(LIMITS.maxCount, s.runs + 1);
	s.best = s.runs === 1 ? wrong : Math.min(s.best, wrong);
	s.lastAt = now;
	return next;
}

export function addPractice(doc, deviceId, day, seconds, now) {
	if (!DAY_RE.test(day) || seconds <= 0) return doc;
	const { next, dev } = deviceFor(doc, deviceId, now);
	dev.practice[day] = Math.min(86_400, (dev.practice[day] ?? 0) + Math.round(seconds));
	const days = Object.keys(dev.practice).sort();
	for (const old of days.slice(0, Math.max(0, days.length - LIMITS.practiceDays))) delete dev.practice[old];
	return next;
}

function median(xs) {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Combined view over all devices for the UI. */
export function aggregate(doc) {
	const out = { lessons: {}, rhythm: {}, pieces: {}, practice: {} };
	for (const dev of Object.values(doc?.devices ?? {})) {
		for (const field of ["lessons", "rhythm"]) {
			for (const [id, byMode] of Object.entries(dev[field] ?? {})) {
				for (const [mode, s] of Object.entries(byMode)) {
					const t = ((out[field][id] ??= {})[mode] ??= { rounds: 0, best: 0, last: 0, lastAt: 0, notes: {} });
					t.rounds += s.rounds;
					t.best = Math.max(t.best, s.best);
					if (s.lastAt >= t.lastAt) {
						t.last = s.last;
						t.lastAt = s.lastAt;
					}
					for (const [k, n] of Object.entries(s.notes ?? {})) {
						const tn = (t.notes[k] ??= { a: 0, w: 0, times: [] });
						tn.a += n.a;
						tn.w += n.w;
						tn.times.push(...n.t);
					}
				}
			}
		}
		for (const [id, s] of Object.entries(dev.pieces ?? {})) {
			const t = (out.pieces[id] ??= { runs: 0, best: null, lastAt: 0 });
			t.runs += s.runs;
			t.best = t.best == null ? s.best : Math.min(t.best, s.best);
			t.lastAt = Math.max(t.lastAt, s.lastAt);
		}
		for (const [day, sec] of Object.entries(dev.practice ?? {})) out.practice[day] = (out.practice[day] ?? 0) + sec;
	}
	for (const field of ["lessons", "rhythm"])
		for (const byMode of Object.values(out[field]))
			for (const s of Object.values(byMode))
				for (const n of Object.values(s.notes)) {
					n.medianMs = median(n.times);
					delete n.times;
				}
	return out;
}

export function localDay(ms) {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Minutes today and in the last 7 days, and the streak of consecutive days with practice. */
export function practiceSummary(practice, now) {
	const DAY = 86_400_000;
	const today = localDay(now);
	let week = 0;
	for (let i = 0; i < 7; i++) week += practice[localDay(now - i * DAY)] ?? 0;
	let streak = 0;
	for (let i = practice[today] ? 0 : 1; practice[localDay(now - i * DAY)]; i++) streak++;
	return { todaySec: practice[today] ?? 0, weekSec: week, streak };
}
