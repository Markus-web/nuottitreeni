// Microphone pitch detection (src/core/pitch.js) with synthetic audio: pure tones, piano-like
// tones whose upper harmonics are louder than the fundamental, silence and noise, and the
// note tracker that turns frames into note on/off events.
import assert from "node:assert/strict";
import { test } from "node:test";
import { NoteTracker, detectPitch, hzToMidi, rms } from "../../src/core/pitch.js";

const RATE = 48000;
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function tone(hz, { harmonics = [1], amp = 0.3, length = 2048, phase = 0 } = {}) {
	const out = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		let v = 0;
		harmonics.forEach((a, k) => (v += a * Math.sin(2 * Math.PI * hz * (k + 1) * (i / RATE) + phase * (k + 1))));
		out[i] = amp * v;
	}
	return out;
}

test("pure tones across the piano's middle range are recognised to the semitone", () => {
	for (const m of [43, 48, 55, 60, 64, 69, 72, 76, 81, 88]) {
		const r = detectPitch(tone(midiHz(m)), RATE);
		assert.ok(r, `midi ${m} detected`);
		assert.equal(Math.round(hzToMidi(r.hz)), m, `midi ${m}: got ${r.hz.toFixed(2)} Hz`);
		assert.ok(Math.abs(hzToMidi(r.hz) - m) < 0.2, `midi ${m} within 20 cents`);
		assert.ok(r.clarity > 0.9);
	}
});

test("piano-like tones with a weak fundamental are not mistaken for an octave", () => {
	const piano = [0.5, 1, 0.7, 0.45, 0.3, 0.2, 0.12];
	for (const m of [48, 52, 57, 60, 65, 71]) {
		const r = detectPitch(tone(midiHz(m), { harmonics: piano }), RATE);
		assert.ok(r, `midi ${m} detected`);
		assert.equal(Math.round(hzToMidi(r.hz)), m);
	}
});

test("silence and white noise give no confident pitch", () => {
	assert.equal(detectPitch(new Float32Array(2048), RATE), null);
	let seed = 7;
	const noise = new Float32Array(2048).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.4);
	const r = detectPitch(noise, RATE);
	assert.ok(r === null || r.clarity < 0.8, "noise is rejected by the tracker's clarity limit");
	assert.equal(rms(new Float32Array(16)), 0);
});

test("note tracker: a held pitch starts after two frames, silence ends it", () => {
	const tr = new NoteTracker();
	const a4 = { hz: 440, clarity: 0.95 };
	assert.deepEqual(tr.feed(0.05, a4), []);
	assert.deepEqual(tr.feed(0.05, a4).map((e) => [e.midi, e.on]), [[69, true]]);
	assert.deepEqual(tr.feed(0.05, a4), []);
	assert.deepEqual(tr.feed(0, null), []);
	assert.deepEqual(tr.feed(0, null), []);
	assert.deepEqual(tr.feed(0, null).map((e) => [e.midi, e.on]), [[69, false]]);
});

test("note tracker: a new pitch replaces the old one, a louder frame restrikes the same pitch", () => {
	const tr = new NoteTracker();
	const c4 = { hz: midiHz(60), clarity: 0.95 };
	const e4 = { hz: midiHz(64), clarity: 0.95 };
	tr.feed(0.05, c4);
	tr.feed(0.05, c4);
	tr.feed(0.05, e4);
	assert.deepEqual(tr.feed(0.05, e4).map((e) => [e.midi, e.on]), [[60, false], [64, true]]);
	tr.feed(0.02, e4);
	assert.deepEqual(tr.feed(0.08, e4).map((e) => [e.midi, e.on]), [[64, false], [64, true]]);
	assert.deepEqual(tr.flush().map((e) => [e.midi, e.on]), [[64, false]]);
});

test("note tracker reset ends the note and needs two frames again (app sound was playing)", () => {
	const tr = new NoteTracker();
	const a4 = { hz: 440, clarity: 0.95 };
	tr.feed(0.05, a4);
	tr.feed(0.05, a4);
	assert.deepEqual(tr.reset().map((e) => [e.midi, e.on]), [[69, false]]);
	assert.deepEqual(tr.feed(0.05, a4), []);
	assert.deepEqual(tr.feed(0.05, a4).map((e) => [e.midi, e.on]), [[69, true]]);
});

test("note tracker ignores quiet frames, unclear pitch and out-of-tune sounds", () => {
	const tr = new NoteTracker();
	for (let i = 0; i < 4; i++) assert.deepEqual(tr.feed(0.002, { hz: 440, clarity: 0.95 }), []);
	for (let i = 0; i < 4; i++) assert.deepEqual(tr.feed(0.05, { hz: 440, clarity: 0.5 }), []);
	for (let i = 0; i < 4; i++) assert.deepEqual(tr.feed(0.05, { hz: 440 * 2 ** (0.5 / 12), clarity: 0.95 }), []);
});
