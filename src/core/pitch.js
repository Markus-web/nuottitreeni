// Pitch detection for the microphone input. Pure functions, unit-tested with synthetic audio.
//
// detectPitch: YIN (de Cheveigné and Kawahara, 2002) on a 2x downsampled frame: the cumulative
// mean normalized difference function, the first dip under the threshold, parabolic
// interpolation. Good for one note at a time (a piano key, a voice); chords are not detected.
// NoteTracker: turns frame-by-frame results into note on/off events: a pitch must hold for
// two frames before it counts, silence ends the note, and a clearly louder frame on the same
// pitch counts as a new key press.

/** Root mean square level of a frame (0..1 for float audio). */
export function rms(frame) {
	let s = 0;
	for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i];
	return Math.sqrt(s / Math.max(1, frame.length));
}

export function hzToMidi(hz) {
	return 69 + 12 * Math.log2(hz / 440);
}

/**
 * frame: Float32Array of samples; sampleRate in Hz. Returns { hz, clarity } or null.
 * clarity is 1 - the normalized difference at the chosen period (1 = perfectly periodic).
 */
export function detectPitch(frame, sampleRate, { threshold = 0.15, minHz = 60, maxHz = 2100 } = {}) {
	// Halve the sample rate (average pairs): a quarter of the work, still exact enough here.
	const half = new Float32Array(frame.length >> 1);
	for (let i = 0; i < half.length; i++) half[i] = (frame[2 * i] + frame[2 * i + 1]) / 2;
	const rate = sampleRate / 2;
	const maxTau = Math.min(Math.floor(rate / minHz), half.length >> 1);
	const minTau = Math.max(2, Math.floor(rate / maxHz));
	// Compare n samples with the same samples shifted by up to maxTau + 1 (for interpolation).
	const n = half.length - maxTau - 1;
	if (n <= 0) return null;
	const cmnd = new Float32Array(maxTau + 2).fill(1);
	let running = 0;
	for (let tau = 1; tau <= maxTau + 1; tau++) {
		let sum = 0;
		for (let i = 0; i < n; i++) {
			const x = half[i] - half[i + tau];
			sum += x * x;
		}
		running += sum;
		cmnd[tau] = running > 0 ? (sum * tau) / running : 1;
	}
	let tau = -1;
	for (let t = minTau; t <= maxTau; t++) {
		if (cmnd[t] < threshold) {
			while (t + 1 <= maxTau && cmnd[t + 1] < cmnd[t]) t++;
			tau = t;
			break;
		}
	}
	if (tau < 0) return null;
	const a = cmnd[tau - 1];
	const b = cmnd[tau];
	const c = cmnd[tau + 1] ?? b;
	const denom = a + c - 2 * b;
	const shift = denom !== 0 ? Math.max(-1, Math.min(1, (a - c) / (2 * denom))) : 0;
	return { hz: rate / (tau + shift), clarity: 1 - b };
}

/** Frame-by-frame pitch to note events. feed() returns [{ midi, on, vel }]. */
export class NoteTracker {
	constructor({ minLevel = 0.01, minClarity = 0.8, maxCents = 40, holdFrames = 2, releaseFrames = 3 } = {}) {
		Object.assign(this, { minLevel, minClarity, maxCents, holdFrames, releaseFrames });
		this.current = null;
		this.candidate = null;
		this.count = 0;
		this.quiet = 0;
		this.lastLevel = 0;
	}

	/** level: rms of the frame; pitch: detectPitch() result or null. */
	feed(level, pitch) {
		const out = [];
		let midi = null;
		if (level >= this.minLevel && pitch && pitch.clarity >= this.minClarity) {
			const exact = hzToMidi(pitch.hz);
			const near = Math.round(exact);
			if (Math.abs(exact - near) * 100 <= this.maxCents && near >= 21 && near <= 108) midi = near;
		}
		const vel = Math.max(30, Math.min(120, Math.round(30 + level * 600)));
		if (midi === null) {
			this.candidate = null;
			this.count = 0;
			if (this.current !== null && ++this.quiet >= this.releaseFrames) {
				out.push({ midi: this.current, on: false, vel: 0 });
				this.current = null;
			}
		} else {
			this.quiet = 0;
			if (midi === this.current) {
				// Same pitch, clearly louder than before: the key was struck again.
				if (level > this.lastLevel * 2.2 && level > this.minLevel * 3) out.push({ midi, on: false, vel: 0 }, { midi, on: true, vel });
			} else {
				this.count = midi === this.candidate ? this.count + 1 : 1;
				this.candidate = midi;
				if (this.count >= this.holdFrames) {
					if (this.current !== null) out.push({ midi: this.current, on: false, vel: 0 });
					out.push({ midi, on: true, vel });
					this.current = midi;
					this.candidate = null;
					this.count = 0;
				}
			}
		}
		this.lastLevel = level;
		return out;
	}

	/** Forget everything (the app's own sound was playing): the next note needs two frames again. */
	reset() {
		const out = this.flush();
		this.candidate = null;
		this.count = 0;
		this.quiet = 0;
		this.lastLevel = 0;
		return out;
	}

	/** End the current note (the microphone was turned off). */
	flush() {
		if (this.current === null) return [];
		const out = [{ midi: this.current, on: false, vel: 0 }];
		this.current = null;
		return out;
	}
}
