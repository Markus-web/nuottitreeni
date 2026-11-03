// Microphone input: an acoustic piano or a voice, one note at a time. Experimental.
//
// Audio never leaves the browser: an AnalyserNode gives the latest 2048 samples every 40 ms,
// detectPitch and NoteTracker (../pitch.js) turn them into note events, nothing is stored.
// Echo cancellation, noise suppression and automatic gain are turned off because they bend
// the pitch. The app's own piano sound is never played for microphone notes, and while the app
// plays sound itself (Listen, ear training) the microphone pauses: it would hear that sound.
import { NoteTracker, detectPitch, rms } from "../pitch.js";

const FRAME_MS = 40;

export class MicSource {
	/** onNote(midi, on, vel); onChange() when the microphone starts or stops. */
	constructor(onNote, onChange) {
		this.onNote = onNote;
		this.onChange = onChange;
		this.supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof AudioContext !== "undefined";
		this.active = false;
		this.name = "Microphone";
		// Set by the page: () => true while the app's own sound plays (Sound.isSounding).
		this.isMuted = () => false;
	}

	async permission() {
		try {
			return (await navigator.permissions.query({ name: "microphone" })).state;
		} catch {
			return "prompt";
		}
	}

	async start(name = this.name) {
		if (this.active) return;
		if (!this.supported) throw Object.assign(new Error("unsupported"), { code: "unsupported" });
		this.name = name;
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
		this.ctx = new AudioContext();
		const source = this.ctx.createMediaStreamSource(this.stream);
		this.analyser = this.ctx.createAnalyser();
		this.analyser.fftSize = 2048;
		source.connect(this.analyser);
		this.frame = new Float32Array(this.analyser.fftSize);
		this.tracker = new NoteTracker();
		this.timer = setInterval(() => this.tick(), FRAME_MS);
		this.active = true;
		this.onChange();
	}

	/** Browsers may start audio paused before a user gesture; called on the first click. */
	resume() {
		this.ctx?.resume?.().catch(() => {});
	}

	tick() {
		if (this.isMuted()) {
			for (const e of this.tracker.reset()) this.onNote(e.midi, e.on, e.vel);
			return;
		}
		this.analyser.getFloatTimeDomainData(this.frame);
		const level = rms(this.frame);
		const pitch = level >= this.tracker.minLevel ? detectPitch(this.frame, this.ctx.sampleRate) : null;
		for (const e of this.tracker.feed(level, pitch)) this.onNote(e.midi, e.on, e.vel);
	}

	stop() {
		if (!this.active) return;
		clearInterval(this.timer);
		for (const e of this.tracker.flush()) this.onNote(e.midi, e.on, e.vel);
		for (const track of this.stream.getTracks()) track.stop();
		this.ctx.close().catch(() => {});
		this.active = false;
		this.onChange();
	}

	inputs() {
		return this.active ? [{ id: "mic", name: this.name, manufacturer: "", state: "connected", kind: "mic" }] : [];
	}
}
