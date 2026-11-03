// Pure MIDI parsers for every input path. Output events: { type: "note", on, note, vel, ch }
// or { type: "cc", cc, value, ch }. System messages (clock, active sensing, SysEx) are ignored.

/** One Web MIDI message (MIDIMessageEvent.data). */
export function parseMidiMessage(data) {
	if (!data || data.length < 2) return null;
	const status = data[0];
	if (status >= 0xf0 || status < 0x80) return null;
	const type = status & 0xf0;
	const ch = status & 0x0f;
	if (type === 0x90 && data.length >= 3) return data[2] > 0 ? { type: "note", on: true, note: data[1], vel: data[2], ch } : { type: "note", on: false, note: data[1], vel: 0, ch };
	if (type === 0x80 && data.length >= 3) return { type: "note", on: false, note: data[1], vel: data[2], ch };
	if (type === 0xb0 && data.length >= 3) return { type: "cc", cc: data[1], value: data[2], ch };
	return null;
}

function dataLength(status) {
	const type = status & 0xf0;
	if (type === 0xc0 || type === 0xd0) return 1;
	if (status >= 0xf8) return 0; // real-time
	if (status === 0xf1 || status === 0xf3) return 1;
	if (status === 0xf2) return 2;
	if (status >= 0xf0) return 0;
	return 2;
}

/**
 * Bluetooth LE MIDI packet (BLE-MIDI 1.0): header byte, then timestamp-low + message pairs,
 * with running status (a message may follow without status, and even without its own
 * timestamp). SysEx spanning packets is skipped. Returns an array of raw MIDI messages.
 */
export function parseBleMidiPacket(bytes) {
	const out = [];
	if (!bytes || bytes.length < 3 || (bytes[0] & 0xc0) !== 0x80) return out;
	let i = 1;
	let running = 0;
	let inSysex = false;
	while (i < bytes.length) {
		const b = bytes[i];
		if (inSysex) {
			// A timestamp byte followed by 0xF7 ends SysEx; anything else is SysEx data.
			if (b & 0x80 && bytes[i + 1] === 0xf7) {
				inSysex = false;
				i += 2;
			} else i++;
			continue;
		}
		if (b & 0x80) {
			// Timestamp low byte; the next byte is a status byte or running-status data.
			i++;
			if (i >= bytes.length) break;
			if (bytes[i] & 0x80) {
				const status = bytes[i++];
				if (status === 0xf0) {
					inSysex = true;
					continue;
				}
				if (status >= 0xf8) continue; // real-time, single byte
				if (status < 0xf0) running = status;
				else {
					i += dataLength(status);
					continue;
				}
			}
		}
		if (!running) {
			i++;
			continue;
		}
		const n = dataLength(running);
		if (i + n > bytes.length) break;
		out.push([running, ...bytes.slice(i, i + n)]);
		i += n;
	}
	return out;
}

const CIN_LENGTH = { 0x8: 3, 0x9: 3, 0xa: 3, 0xb: 3, 0xc: 2, 0xd: 2, 0xe: 3 };

/** USB-MIDI 1.0 event packets (4 bytes each), as read from a bulk IN endpoint. */
export function parseUsbMidiPackets(bytes) {
	const out = [];
	for (let i = 0; i + 3 < bytes.length; i += 4) {
		const cin = bytes[i] & 0x0f;
		const len = CIN_LENGTH[cin];
		if (!len) continue;
		out.push(Array.from(bytes.slice(i + 1, i + 1 + len)));
	}
	return out;
}

/** USB-MIDI packet for sending a short message on cable 0. */
export function usbMidiPacket(message) {
	const cin = message[0] >> 4;
	return [cin & 0x0f, message[0], message[1] ?? 0, message[2] ?? 0];
}

/**
 * Computer keyboard piano, by physical key position (KeyboardEvent.code), so it works with
 * any layout: home row = white keys from C, row above = black keys. Offsets from the base C.
 */
export const QWERTY_MAP = {
	KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
	KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
};
export const QWERTY_OCTAVE_DOWN = "KeyZ";
export const QWERTY_OCTAVE_UP = "KeyX";

/** Velocity curves applied per device: soft makes light playing louder, hard the opposite. */
export function applyCurve(vel, curve) {
	const x = Math.max(1, Math.min(127, vel)) / 127;
	const y = curve === "soft" ? Math.sqrt(x) : curve === "hard" ? x * x : x;
	return Math.max(1, Math.round(y * 127));
}
