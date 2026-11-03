import assert from "node:assert/strict";
import { test } from "node:test";
import { QWERTY_MAP, applyCurve, parseBleMidiPacket, parseMidiMessage, parseUsbMidiPackets, usbMidiPacket } from "../../src/core/input/parse.js";

test("Web MIDI messages", () => {
	assert.deepEqual(parseMidiMessage([0x90, 60, 100]), { type: "note", on: true, note: 60, vel: 100, ch: 0 });
	assert.deepEqual(parseMidiMessage([0x91, 60, 0]), { type: "note", on: false, note: 60, vel: 0, ch: 1 });
	assert.deepEqual(parseMidiMessage([0x80, 62, 40]), { type: "note", on: false, note: 62, vel: 40, ch: 0 });
	assert.deepEqual(parseMidiMessage([0xb0, 64, 127]), { type: "cc", cc: 64, value: 127, ch: 0 });
	assert.equal(parseMidiMessage([0xf8]), null, "clock ignored");
	assert.equal(parseMidiMessage([0xfe]), null, "active sensing ignored");
	assert.equal(parseMidiMessage([0xc0, 5]), null, "program change ignored");
});

test("BLE-MIDI packets with timestamps and running status", () => {
	// header, ts, note on C4, ts, note on E4 (running status needs no status byte), ts, note off C4
	const pkt = [0x80, 0x81, 0x90, 60, 100, 0x82, 64, 90, 0x83, 0x80, 60, 0];
	assert.deepEqual(parseBleMidiPacket(pkt), [[0x90, 60, 100], [0x90, 64, 90], [0x80, 60, 0]]);
	// running status without a timestamp in between, and a real-time byte that is skipped
	assert.deepEqual(parseBleMidiPacket([0x80, 0x80, 0x90, 60, 1, 62, 2, 0x81, 0xf8, 0x82, 0xb0, 64, 127]), [[0x90, 60, 1], [0x90, 62, 2], [0xb0, 64, 127]]);
	// SysEx is skipped up to its end marker
	assert.deepEqual(parseBleMidiPacket([0x80, 0x80, 0xf0, 0x43, 0x10, 0x81, 0xf7, 0x82, 0x90, 67, 50]), [[0x90, 67, 50]]);
	assert.deepEqual(parseBleMidiPacket([0x00, 0x90]), [], "bad header");
});

test("USB-MIDI 4-byte event packets", () => {
	const bytes = [0x09, 0x90, 60, 100, 0x08, 0x80, 60, 0, 0x0f, 0xf8, 0, 0, 0x0b, 0xb0, 64, 127, 0x04, 0xf0, 0x43, 0x10];
	assert.deepEqual(parseUsbMidiPackets(bytes), [[0x90, 60, 100], [0x80, 60, 0], [0xb0, 64, 127]]);
	assert.deepEqual(usbMidiPacket([0x90, 60, 100]), [0x09, 0x90, 60, 100]);
});

test("QWERTY map and velocity curves", () => {
	assert.equal(QWERTY_MAP.KeyA, 0);
	assert.equal(QWERTY_MAP.KeyK, 12);
	assert.equal(QWERTY_MAP.KeyW, 1);
	assert.equal(applyCurve(64, "linear"), 64);
	assert.ok(applyCurve(32, "soft") > 32);
	assert.ok(applyCurve(100, "hard") < 100);
	assert.equal(applyCurve(0, "linear"), 1);
});
