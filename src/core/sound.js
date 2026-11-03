// Piano sound in the browser (Web Audio). Samples are MP3s rendered from FluidR3_GM every
// 3 semitones; a note plays the nearest sample at a shifted playback rate. Samples load on
// first use. Browsers only allow audio after a user gesture, so common.js calls unlock() on the
// first click or key press.
import { getSettings } from "./store.js";

const MAX_VOICES = 32;

export class Sound {
	constructor(samples) {
		this.samples = samples; // { notes: [24, 27, ...], urls: { 24: "/assets/piano/24-hash.mp3" } }
		this.ctx = null;
		this.buffers = new Map();
		this.loading = new Map();
		this.voices = new Map();
		this.sustained = new Set();
		this.pedal = false;
	}

	get supported() {
		return typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext);
	}

	unlock() {
		if (!this.supported) return null;
		if (!this.ctx) {
			const AC = window.AudioContext || window.webkitAudioContext;
			this.ctx = new AC({ latencyHint: "interactive" });
			this.master = this.ctx.createGain();
			this.master.gain.value = getSettings().volume;
			this.master.connect(this.ctx.destination);
		}
		if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
		return this.ctx;
	}

	setVolume(v) {
		if (this.master) this.master.gain.value = v;
	}

	nearest(midi) {
		let best = this.samples.notes[0];
		for (const n of this.samples.notes) if (Math.abs(n - midi) < Math.abs(best - midi)) best = n;
		return best;
	}

	load(sampleMidi) {
		if (this.buffers.has(sampleMidi)) return Promise.resolve(this.buffers.get(sampleMidi));
		if (this.loading.has(sampleMidi)) return this.loading.get(sampleMidi);
		const p = fetch(this.samples.urls[sampleMidi])
			.then((r) => r.arrayBuffer())
			.then((ab) => this.ctx.decodeAudioData(ab))
			.then((buf) => {
				this.buffers.set(sampleMidi, buf);
				this.loading.delete(sampleMidi);
				return buf;
			})
			.catch((e) => {
				this.loading.delete(sampleMidi);
				throw e;
			});
		this.loading.set(sampleMidi, p);
		return p;
	}

	/** Load every sample in the background (idle time), so later notes start instantly. */
	preload() {
		if (!this.ctx) return;
		for (const n of this.samples.notes) this.load(n).catch(() => {});
	}

	async play(midi, vel = 90, when = 0) {
		if (!getSettings().sound) return;
		const ctx = this.unlock();
		if (!ctx) return;
		const s = this.nearest(midi);
		let buf;
		try {
			buf = this.buffers.get(s) ?? (await this.load(s));
		} catch {
			return;
		}
		this.release(midi, 0.05);
		if (this.voices.size >= MAX_VOICES) this.release(this.voices.keys().next().value, 0.05);
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.playbackRate.value = 2 ** ((midi - s) / 12);
		const g = ctx.createGain();
		g.gain.value = 0.25 + 0.75 * (vel / 127) ** 1.6;
		src.connect(g).connect(this.master);
		const t = Math.max(ctx.currentTime, when || 0);
		src.start(t);
		this.voices.set(midi, { src, g });
		this.sustained.delete(midi);
		src.onended = () => {
			if (this.voices.get(midi)?.src === src) this.voices.delete(midi);
		};
	}

	stop(midi) {
		if (this.pedal) this.sustained.add(midi);
		else this.release(midi);
	}

	release(midi, seconds = 0.3) {
		const v = this.voices.get(midi);
		if (!v || !this.ctx) return;
		const now = this.ctx.currentTime;
		v.g.gain.cancelScheduledValues(now);
		v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), now);
		v.g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
		v.src.stop(now + seconds + 0.02);
		this.voices.delete(midi);
	}

	setPedal(down) {
		this.pedal = down;
		if (!down) {
			for (const m of this.sustained) this.release(m);
			this.sustained.clear();
		}
	}

	/** Short click for the metronome at audio time `when`. */
	click(accent, when) {
		const ctx = this.unlock();
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.frequency.value = accent ? 1320 : 880;
		g.gain.setValueAtTime(0.0001, when);
		g.gain.exponentialRampToValueAtTime(accent ? 0.6 : 0.35, when + 0.002);
		g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
		osc.connect(g).connect(this.master);
		osc.start(when);
		osc.stop(when + 0.07);
	}

	/** Play a list of { midi, at (s from now), dur (s), vel } and return a stop function. */
	sequence(notes) {
		const ctx = this.unlock();
		if (!ctx) return () => {};
		const timers = [];
		for (const n of notes) {
			timers.push(setTimeout(() => this.play(n.midi, n.vel ?? 80), n.at * 1000));
			timers.push(setTimeout(() => this.release(n.midi), (n.at + n.dur) * 1000));
		}
		return () => {
			for (const t of timers) clearTimeout(t);
			for (const n of notes) this.release(n.midi, 0.05);
		};
	}
}

/** Lookahead metronome: schedules clicks slightly ahead on the audio clock. */
export class Metronome {
	constructor(sound) {
		this.sound = sound;
		this.timer = null;
	}

	/**
	 * Start: onBeat({ index, bar, beat, perfTime }) fires for every scheduled beat with the
	 * performance.now() time of the click, used to judge timing against key presses.
	 */
	start({ bpm, beatsPerBar = 4, beats = Infinity, onBeat }) {
		const ctx = this.sound.unlock();
		if (!ctx) return false;
		this.stop();
		const spb = 60 / bpm;
		let index = 0;
		let next = ctx.currentTime + 0.15;
		const tick = () => {
			while (next < ctx.currentTime + 0.12 && index < beats) {
				const beat = index % beatsPerBar;
				this.sound.click(beat === 0, next);
				const perfTime = performance.now() + (next - ctx.currentTime) * 1000;
				onBeat?.({ index, bar: Math.floor(index / beatsPerBar), beat, perfTime });
				index++;
				next += spb;
			}
			if (index >= beats) this.stop();
		};
		tick();
		this.timer = setInterval(tick, 25);
		return true;
	}

	stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}
