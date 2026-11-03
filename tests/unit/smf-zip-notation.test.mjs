import assert from "node:assert/strict";
import { test } from "node:test";
import { PIECES } from "../../src/content/catalog.js";
import { melodySteps, parseMelody, toMusicXml, toStaffItems } from "../../src/core/notation.js";
import { encodeSmf, noteRange, parseSmf, tickToMs, toSteps } from "../../src/core/smf.js";
import { crc32, zipStore } from "../../src/core/zip.js";

test("SMF writer and reader round-trip", () => {
	const events = [
		{ type: "note", on: true, note: 60, vel: 90, t: 0 },
		{ type: "note", on: true, note: 64, vel: 80, t: 10 },
		{ type: "note", on: false, note: 60, t: 500 },
		{ type: "note", on: false, note: 64, t: 500 },
		{ type: "cc", cc: 64, value: 127, t: 600 },
		{ type: "note", on: true, note: 67, vel: 70, t: 1000 },
		{ type: "note", on: false, note: 67, t: 1500 },
	];
	const parsed = parseSmf(encodeSmf(events, 0));
	assert.equal(parsed.ppq, 480);
	assert.deepEqual(noteRange(parsed), { min: 60, max: 67, count: 3 });
	const steps = toSteps(parsed, { groupMs: 40 });
	assert.deepEqual(steps.map((s) => s.notes.map((n) => n.midi)), [[60, 64], [67]]);
	assert.ok(Math.abs(steps[1].ms - 1000) < 3);
});

test("SMF reader handles format 1, running status and tempo changes", () => {
	// Hand-built format 1 file: tempo track + two note tracks (right high, left low), running status.
	const vlq = (n) => (n < 128 ? [n] : [(n >> 7) | 0x80, n & 0x7f]);
	const chunk = (bytes) => [0x4d, 0x54, 0x72, 0x6b, 0, 0, (bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes];
	const tempo = chunk([0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, ...vlq(480), 0xff, 0x51, 3, 0x0f, 0x42, 0x40, 0, 0xff, 0x2f, 0]);
	const right = chunk([0, 0x90, 72, 80, ...vlq(480), 72, 0, 0, 74, 80, ...vlq(480), 0x80, 74, 0, 0, 0xff, 0x2f, 0]);
	const left = chunk([0, 0x91, 48, 70, ...vlq(960), 0x81, 48, 0, 0, 0xff, 0x2f, 0]);
	const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 3, 0x01, 0xe0];
	const parsed = parseSmf(new Uint8Array([...header, ...tempo, ...right, ...left]));
	assert.equal(parsed.format, 1);
	assert.equal(parsed.tracks[1].notes.length, 2);
	assert.equal(tickToMs(480, 480, parsed.tempos), 500);
	assert.equal(tickToMs(960, 480, parsed.tempos), 1500, "second beat at 60 BPM");
	const steps = toSteps(parsed);
	assert.deepEqual(steps[0].notes.map((n) => [n.midi, n.hand]), [[48, "left"], [72, "right"]]);
});

test("SMF reader rejects garbage", () => {
	assert.throws(() => parseSmf(new Uint8Array([1, 2, 3])), /not a MIDI file/);
});

test("ZIP store writer produces a valid archive", () => {
	assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
	const zip = zipStore([{ name: "a.mid", data: new Uint8Array([1, 2, 3]) }, { name: "kansio/ä.mid", data: new Uint8Array(0) }]);
	const dv = new DataView(zip.buffer);
	assert.equal(dv.getUint32(0, true), 0x04034b50);
	assert.equal(dv.getUint32(zip.length - 22, true), 0x06054b50);
	assert.equal(dv.getUint16(zip.length - 22 + 10, true), 2);
});

test("melody notation parses, beams eighths and becomes MusicXML", () => {
	const items = parseMelody("G4e A4e G4e F4e E4q C4q | C4w");
	const staff = toStaffItems(items, "treble");
	assert.deepEqual(staff.slice(0, 4).map((i) => i.beam), ["begin", "end", "begin", "end"]);
	assert.deepEqual(melodySteps(items).map((s) => s.bar), [1, 1, 1, 1, 1, 1, 2]);
	for (const p of PIECES) {
		const xml = toMusicXml({ title: p.id, composer: p.composer, fifths: p.fifths, time: p.time, right: p.right });
		assert.match(xml, /<score-partwise version="4.0">/);
		const notes = (xml.match(/<note>/g) || []).length;
		assert.equal(notes, melodySteps(parseMelody(p.right)).reduce((a, s) => a + s.notes.length, 0), `${p.id} note count`);
	}
	assert.throws(() => parseMelody("C4x"), /bad token/);
	assert.throws(() => parseMelody("H4q"), /bad pitch/);
});
