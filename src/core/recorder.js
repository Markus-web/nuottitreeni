// Practice recorder: the first note starts a session, settings.idleSec of silence ends it.
// Sessions add practice minutes to the progress document; sessions with at least MIN_NOTES
// notes are kept as MIDI takes in IndexedDB (this browser only, never synced).
import { encodeSmf } from "./smf.js";
import { addPractice, localDay } from "./progress.js";
import { getDeviceId, getProgress, getSettings, idb, saveProgress } from "./store.js";

const MIN_NOTES = 4;
export const MAX_TAKES = 200;
const MAX_EVENTS = 20000;

export class Recorder extends EventTarget {
	constructor(hub) {
		super();
		this.session = null;
		this.timer = null;
		this.piece = null;
		hub.addEventListener("note", (e) => this.push({ type: "note", on: e.detail.on, note: e.detail.midi, vel: e.detail.vel, t: performance.now() }));
		hub.addEventListener("pedal", (e) => this.push({ type: "cc", cc: 64, value: e.detail.down ? 127 : 0, t: performance.now() }));
		const flush = () => this.flush();
		addEventListener("pagehide", flush);
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flush();
		});
	}

	push(ev) {
		if (!this.session) {
			if (!(ev.type === "note" && ev.on)) return;
			this.session = { start: ev.t, wall: Date.now(), events: [], notes: 0, last: ev.t, piece: this.piece };
			this.dispatchEvent(new CustomEvent("session", { detail: { state: "start" } }));
		}
		const s = this.session;
		if (s.events.length < MAX_EVENTS) s.events.push(ev);
		if (ev.type === "note" && ev.on) s.notes++;
		s.last = ev.t;
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.flush(), getSettings().idleSec * 1000);
	}

	async flush() {
		clearTimeout(this.timer);
		const s = this.session;
		this.session = null;
		if (!s) return;
		const seconds = Math.max(1, Math.round((s.last - s.start) / 1000));
		saveProgress(addPractice(getProgress(), getDeviceId(), localDay(s.wall), seconds, Date.now()));
		this.dispatchEvent(new CustomEvent("session", { detail: { state: "end", seconds } }));
		if (!getSettings().autoRecord || s.notes < MIN_NOTES) return;
		// Close hanging notes and the pedal so a take never ends with a stuck key.
		const held = new Set();
		for (const ev of s.events) if (ev.type === "note") ev.on ? held.add(ev.note) : held.delete(ev.note);
		const tail = s.last + 50;
		const closing = [...held].map((note) => ({ type: "note", on: false, note, vel: 0, t: tail }));
		closing.push({ type: "cc", cc: 64, value: 0, t: tail });
		const smf = encodeSmf([...s.events, ...closing], s.start - 300, "Nuottitreeni");
		try {
			await idb.put("takes", { id: String(s.wall), startedAt: s.wall, seconds, notes: s.notes, piece: s.piece, smf });
			const all = await idb.all("takes");
			if (all.length > MAX_TAKES) {
				all.sort((a, b) => a.startedAt - b.startedAt);
				for (const old of all.slice(0, all.length - MAX_TAKES)) await idb.delete("takes", old.id);
				this.dispatchEvent(new CustomEvent("capped"));
			}
			this.dispatchEvent(new CustomEvent("saved"));
		} catch {
			// IndexedDB unavailable: minutes are still counted, the take is not kept.
		}
	}
}
