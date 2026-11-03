// Standard MIDI File support. Pure functions over bytes, shared by the recorder (writer),
// the piece importer (reader) and the build (sample rendering).
//
// Writer: format 0, 480 ticks per quarter at 120 BPM (1 tick = 1.0417 ms).
// Reader: formats 0 and 1, running status, tempo map, note on/off pairing, track names.

const PPQ = 480;
const TEMPO_US = 500000;
const TICKS_PER_MS = (PPQ * 1000) / TEMPO_US;

function vlq(n) {
	const bytes = [n & 0x7f];
	n >>= 7;
	while (n > 0) {
		bytes.unshift((n & 0x7f) | 0x80);
		n >>= 7;
	}
	return bytes;
}

function eventBytes(ev) {
	const ch = (ev.ch ?? 0) & 0x0f;
	switch (ev.type) {
		case "note":
			return ev.on ? [0x90 | ch, ev.note, Math.max(1, Math.min(127, ev.vel))] : [0x80 | ch, ev.note, 0];
		case "cc":
			return [0xb0 | ch, ev.cc & 0x7f, ev.value & 0x7f];
		default:
			return null;
	}
}

/** events: [{ type: "note"|"cc", t: ms, ... }] sorted by t; startMs = time of tick 0. Returns Uint8Array. */
export function encodeSmf(events, startMs = 0, trackName = "Nuottitreeni") {
	const track = [];
	const name = new TextEncoder().encode(trackName);
	track.push(0x00, 0xff, 0x03, ...vlq(name.length), ...name);
	track.push(0x00, 0xff, 0x51, 0x03, (TEMPO_US >> 16) & 0xff, (TEMPO_US >> 8) & 0xff, TEMPO_US & 0xff);
	let lastTick = 0;
	for (const ev of events) {
		const bytes = eventBytes(ev);
		if (!bytes) continue;
		const tick = Math.max(lastTick, Math.round((ev.t - startMs) * TICKS_PER_MS));
		track.push(...vlq(tick - lastTick), ...bytes);
		lastTick = tick;
	}
	track.push(0x00, 0xff, 0x2f, 0x00);
	const out = new Uint8Array(14 + 8 + track.length);
	const dv = new DataView(out.buffer);
	out.set([0x4d, 0x54, 0x68, 0x64], 0);
	dv.setUint32(4, 6);
	dv.setUint16(8, 0);
	dv.setUint16(10, 1);
	dv.setUint16(12, PPQ);
	out.set([0x4d, 0x54, 0x72, 0x6b], 14);
	dv.setUint32(18, track.length);
	out.set(track, 22);
	return out;
}

export class SmfError extends Error {}

/**
 * Parse an SMF. Returns { format, ppq, tracks: [{ name, notes: [{ tick, dur, midi, vel, ch }] }], tempos: [{ tick, us }] }.
 * Throws SmfError on malformed data. SMPTE timing is rejected (rare for music files).
 */
export function parseSmf(input) {
	const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
	const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const str = (o) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
	if (buf.length < 14 || str(0) !== "MThd") throw new SmfError("not a MIDI file");
	const format = dv.getUint16(8);
	const ntracks = dv.getUint16(10);
	const division = dv.getUint16(12);
	if (division & 0x8000) throw new SmfError("SMPTE time division is not supported");
	const ppq = division;
	let pos = 8 + dv.getUint32(4);
	const tracks = [];
	const tempos = [];
	for (let t = 0; t < ntracks && pos + 8 <= buf.length; t++) {
		if (str(pos) !== "MTrk") throw new SmfError("missing track chunk");
		const len = dv.getUint32(pos + 4);
		const end = Math.min(buf.length, pos + 8 + len);
		let p = pos + 8;
		let tick = 0;
		let running = 0;
		const open = new Map();
		const track = { name: "", notes: [] };
		const readVlq = () => {
			let v = 0;
			let b;
			let guard = 0;
			do {
				if (p >= end || guard++ > 4) throw new SmfError("bad variable-length number");
				b = buf[p++];
				v = (v << 7) | (b & 0x7f);
			} while (b & 0x80);
			return v;
		};
		while (p < end) {
			tick += readVlq();
			let status = buf[p];
			if (status & 0x80) p++;
			else if (running) status = running;
			else throw new SmfError("running status without a status byte");
			if (status === 0xff) {
				const type = buf[p++];
				const l = readVlq();
				if (type === 0x03 && !track.name) track.name = new TextDecoder().decode(buf.subarray(p, p + l)).trim();
				if (type === 0x51 && l === 3) tempos.push({ tick, us: (buf[p] << 16) | (buf[p + 1] << 8) | buf[p + 2] });
				p += l;
				continue;
			}
			if (status === 0xf0 || status === 0xf7) {
				p += readVlq();
				continue;
			}
			running = status;
			const hi = status & 0xf0;
			const ch = status & 0x0f;
			const d1 = buf[p];
			const d2 = buf[p + 1];
			p += hi === 0xc0 || hi === 0xd0 ? 1 : 2;
			const key = (ch << 8) | d1;
			if (hi === 0x90 && d2 > 0) {
				if (!open.has(key)) open.set(key, []);
				open.get(key).push({ tick, vel: d2 });
			} else if (hi === 0x80 || (hi === 0x90 && d2 === 0)) {
				const stack = open.get(key);
				const on = stack?.shift();
				if (on) track.notes.push({ tick: on.tick, dur: Math.max(1, tick - on.tick), midi: d1, vel: on.vel, ch });
			}
		}
		for (const [key, stack] of open) for (const on of stack) track.notes.push({ tick: on.tick, dur: Math.max(1, tick - on.tick), midi: key & 0xff, vel: on.vel, ch: key >> 8 });
		track.notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi);
		tracks.push(track);
		pos = end;
	}
	tempos.sort((a, b) => a.tick - b.tick);
	return { format, ppq, tracks, tempos };
}

/** Milliseconds for a tick, honouring the tempo map (default 120 BPM). */
export function tickToMs(tick, ppq, tempos) {
	let ms = 0;
	let lastTick = 0;
	let us = TEMPO_US;
	for (const tp of tempos) {
		if (tp.tick >= tick) break;
		ms += ((tp.tick - lastTick) * us) / ppq / 1000;
		lastTick = tp.tick;
		us = tp.us;
	}
	return ms + ((tick - lastTick) * us) / ppq / 1000;
}

export function noteRange(parsed) {
	let min = 128;
	let max = -1;
	let count = 0;
	for (const t of parsed.tracks)
		for (const n of t.notes) {
			min = Math.min(min, n.midi);
			max = Math.max(max, n.midi);
			count++;
		}
	return count ? { min, max, count } : null;
}

/**
 * Practice steps for wait mode: notes that start within `groupMs` form one step.
 * Hands: with two or more note tracks, the track with the higher average pitch is the right
 * hand and the rest are left; with one track, notes at or above `split` are right.
 * Returns [{ ms, notes: [{ midi, hand }] }].
 */
export function toSteps(parsed, { groupMs = 40, split = 60 } = {}) {
	const noteTracks = parsed.tracks.filter((t) => t.notes.length);
	let handOf;
	if (noteTracks.length >= 2) {
		const avg = noteTracks.map((t) => t.notes.reduce((a, n) => a + n.midi, 0) / t.notes.length);
		const right = noteTracks[avg.indexOf(Math.max(...avg))];
		handOf = (track) => (track === right ? "right" : "left");
	} else {
		handOf = null;
	}
	const all = [];
	for (const t of noteTracks)
		for (const n of t.notes) all.push({ ms: tickToMs(n.tick, parsed.ppq, parsed.tempos), midi: n.midi, hand: handOf ? handOf(t) : n.midi >= split ? "right" : "left" });
	all.sort((a, b) => a.ms - b.ms || a.midi - b.midi);
	const steps = [];
	for (const n of all) {
		const last = steps[steps.length - 1];
		if (last && n.ms - last.ms <= groupMs) {
			if (!last.notes.some((x) => x.midi === n.midi)) last.notes.push({ midi: n.midi, hand: n.hand });
		} else steps.push({ ms: n.ms, notes: [{ midi: n.midi, hand: n.hand }] });
	}
	return steps;
}
