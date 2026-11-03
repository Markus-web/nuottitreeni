// Browser storage: settings, progress and sync state in localStorage; recordings and imported
// files in IndexedDB. Every access is guarded: when storage is blocked (private mode, browser
// settings) the app keeps working in memory and tells the user that nothing is saved.
// Storage keys are a stable contract (docs/privacy-design.md lists them).
import { generateDeviceId } from "./sync-code.js";
import { emptyProgress } from "./progress.js";

const PREFIX = "nt.v1.";
const memory = new Map();
let available = null;

export function storageAvailable() {
	if (available !== null) return available;
	try {
		const k = `${PREFIX}probe`;
		localStorage.setItem(k, "1");
		localStorage.removeItem(k);
		available = true;
	} catch {
		available = false;
	}
	return available;
}

export function getJson(key, fallback) {
	try {
		const raw = storageAvailable() ? localStorage.getItem(PREFIX + key) : memory.get(key);
		return raw == null ? fallback : JSON.parse(raw);
	} catch {
		return fallback;
	}
}

export function setJson(key, value) {
	const raw = JSON.stringify(value);
	try {
		if (storageAvailable()) localStorage.setItem(PREFIX + key, raw);
		else memory.set(key, raw);
		return true;
	} catch {
		memory.set(key, raw);
		return false;
	}
}

export function removeKey(key) {
	try {
		if (storageAvailable()) localStorage.removeItem(PREFIX + key);
	} catch {
		/* storage blocked: nothing to remove */
	}
	memory.delete(key);
}

export const DEFAULT_SETTINGS = {
	theme: "system",
	namesOnKeys: true,
	showAllKeys: false,
	sound: true,
	volume: 0.8,
	playIncoming: true,
	midiOut: "",
	inputsOff: [],
	autoRecord: true,
	idleSec: 90,
	dailyGoalMin: 10,
	autoSync: true,
	// "auto" = the language's own system (locale meta.noteNames), or a NOTE_NAME_SYSTEMS value.
	noteNames: "auto",
	// Piece page: names and suggested fingers on the score, falling notes, next-note marks.
	scoreNames: false,
	scoreFingers: false,
	fallingNotes: false,
	nextNotes: true,
	// Note colours (C red ... B violet) on keys, falling notes and name buttons; off by default.
	noteColors: false,
	// "How to practise" boxes already seen (open on the first visit, closed after): mode keys.
	seenHelp: [],
	// Microphone input was on: restart it on the next page if permission is still granted.
	micOn: false,
	// Free practice: last configuration (normalized by freeConfig in content/catalog.js).
	freePractice: null,
};

export function getSettings() {
	return { ...DEFAULT_SETTINGS, ...getJson("settings", {}) };
}

export function saveSettings(patch) {
	const next = { ...getSettings(), ...patch };
	setJson("settings", next);
	dispatchEvent(new CustomEvent("nt-settings", { detail: next }));
	return next;
}

export function getDeviceId() {
	let id = getJson("device", null);
	if (typeof id !== "string" || !/^[a-z0-9]{8,40}$/.test(id)) {
		id = generateDeviceId();
		setJson("device", id);
	}
	return id;
}

export function getProgress() {
	const doc = getJson("progress", null);
	return doc && doc.v === 1 && doc.devices ? doc : emptyProgress();
}

export function saveProgress(doc) {
	setJson("progress", doc);
	dispatchEvent(new CustomEvent("nt-progress", { detail: doc }));
}

/** Per-MIDI-device settings, keyed by "name|manufacturer". */
// keys: keyboard size (KEYBOARD_SIZES in keyboard-layout.js); null = not set (a known model's
// size is used), 0 = unknown on purpose (no range warning).
export const DEFAULT_DEVICE = { channel: 0, octave: 0, transpose: 0, curve: "linear", minVelocity: 1, split: 60, keys: null };

export function getDeviceSettings(key) {
	return { ...DEFAULT_DEVICE, ...(getJson("devices", {})[key] ?? {}) };
}

export function saveDeviceSettings(key, patch) {
	const all = getJson("devices", {});
	all[key] = { ...getDeviceSettings(key), ...patch };
	setJson("devices", all);
	return all[key];
}

export function getSyncState() {
	return getJson("sync", { code: null, rev: 0, lastSyncAt: 0 });
}

export function saveSyncState(state) {
	setJson("sync", state);
	dispatchEvent(new CustomEvent("nt-sync", { detail: state }));
}

/** Remove everything this app stored in this browser. */
export async function clearAll() {
	try {
		if (storageAvailable()) for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
	} catch {
		/* blocked storage */
	}
	memory.clear();
	try {
		await new Promise((resolve) => {
			const req = indexedDB.deleteDatabase("nuottitreeni");
			req.onsuccess = req.onerror = req.onblocked = () => resolve();
		});
	} catch {
		/* no IndexedDB */
	}
}

// ---- IndexedDB (recordings and imported pieces) --------------------------------------
let dbPromise = null;

export function openDb() {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
		const req = indexedDB.open("nuottitreeni", 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains("takes")) db.createObjectStore("takes", { keyPath: "id" });
			if (!db.objectStoreNames.contains("pieces")) db.createObjectStore("pieces", { keyPath: "id" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	dbPromise.catch(() => {
		dbPromise = null;
	});
	return dbPromise;
}

function tx(store, mode, fn) {
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				const t = db.transaction(store, mode);
				const result = fn(t.objectStore(store));
				t.oncomplete = () => resolve(result?.result ?? result);
				t.onerror = () => reject(t.error);
				t.onabort = () => reject(t.error);
			}),
	);
}

export const idb = {
	put: (store, value) => tx(store, "readwrite", (s) => s.put(value)),
	delete: (store, key) => tx(store, "readwrite", (s) => s.delete(key)),
	get: (store, key) => tx(store, "readonly", (s) => s.get(key)),
	all: (store) => tx(store, "readonly", (s) => s.getAll()),
};
