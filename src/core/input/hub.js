// Input hub: one stream of note events from every source (MIDI devices, Bluetooth, USB,
// microphone, on-screen keys, computer keyboard). Applies per-device settings (channel, octave, transpose,
// velocity curve, minimum velocity) and keeps a small monitor log for the Devices page.
//
// Events (EventTarget):
//   "note"   detail { midi, on, vel, source: "device"|"mic"|"screen", device, latency }
//   "pedal"  detail { down }
//   "status" detail { state: "none"|"connecting"|"connected"|"unsupported"|"denied"|"none-found", names }
//   "message" detail { device, text }          (monitor)
import { getDeviceSettings, getSettings } from "../store.js";
import { BleMidiSource, UsbMidiSource, WebMidiSource } from "./adapters.js";
import { MicSource } from "./mic.js";
import { applyCurve, parseMidiMessage } from "./parse.js";

const PIANO_LOW = 21;
const PIANO_HIGH = 108;

export class InputHub extends EventTarget {
	constructor() {
		super();
		const onMessage = (m) => this.handle(m);
		const onChange = () => this.updateStatus();
		this.web = new WebMidiSource(onMessage, onChange);
		this.ble = new BleMidiSource(onMessage, onChange);
		this.usb = new UsbMidiSource(onMessage, onChange);
		this.mic = new MicSource((midi, on, vel) => this.emitNote(midi, on, vel, "mic", this.mic.name, null), onChange);
		this.state = this.web.supported ? "none" : "unsupported";
		this.monitor = [];
		this.range = { min: null, max: null };
		this.lastLatency = null;
		this.held = new Set();
	}

	/** Reconnect silently where the user already gave permission (no prompts on page load). */
	async init() {
		if ((await this.web.permission()) === "granted") await this.connectMidi().catch(() => {});
		await this.usb.reconnect().catch(() => {});
		this.updateStatus();
	}

	async connectMidi() {
		this.setStatus("connecting");
		try {
			await this.web.open();
		} catch (e) {
			this.setStatus(e?.code === "unsupported" ? "unsupported" : "denied");
			throw e;
		}
		this.updateStatus(true);
	}

	connectBle() {
		return this.ble.connect();
	}

	connectUsb() {
		return this.usb.connect();
	}

	/** Microphone on or off; name is shown in the device status line. */
	startMic(name) {
		return this.mic.start(name);
	}

	stopMic() {
		this.mic.stop();
	}

	inputs() {
		return [...this.web.inputs().filter((i) => i.state === "connected"), ...this.ble.inputs(), ...this.usb.inputs(), ...this.mic.inputs()];
	}

	outputs() {
		return this.web.outputs().filter((o) => o.state === "connected");
	}

	updateStatus(afterPrompt = false) {
		const names = this.inputs().map((i) => i.name);
		if (names.length) this.setStatus("connected", names);
		else if (this.web.access && afterPrompt) this.setStatus("none-found");
		else if (!this.web.supported && !this.ble.supported && !this.usb.supported && !this.mic.supported) this.setStatus("unsupported");
		else this.setStatus(this.web.supported ? "none" : "unsupported");
	}

	setStatus(state, names = []) {
		this.state = state;
		this.names = names;
		this.dispatchEvent(new CustomEvent("status", { detail: { state, names } }));
	}

	handle({ key, name, data, ts }) {
		const settings = getSettings();
		if (settings.inputsOff.includes(key)) return;
		const latency = typeof ts === "number" && ts > 0 ? Math.max(0, performance.now() - ts) : null;
		const msg = parseMidiMessage(data);
		const text = Array.from(data, (b) => b.toString(16).padStart(2, "0")).join(" ");
		this.monitor.push({ device: name, text, t: Date.now() });
		if (this.monitor.length > 50) this.monitor.shift();
		this.dispatchEvent(new CustomEvent("message", { detail: { device: name, text } }));
		if (!msg) return;
		const dev = getDeviceSettings(key);
		if (dev.channel && msg.ch !== dev.channel - 1) return;
		if (msg.type === "cc") {
			if (msg.cc === 64) this.dispatchEvent(new CustomEvent("pedal", { detail: { down: msg.value >= 64 } }));
			return;
		}
		const raw = msg.note;
		this.range.min = this.range.min == null ? raw : Math.min(this.range.min, raw);
		this.range.max = this.range.max == null ? raw : Math.max(this.range.max, raw);
		const midi = raw + dev.octave * 12 + dev.transpose;
		if (midi < PIANO_LOW || midi > PIANO_HIGH) return;
		if (msg.on && msg.vel < dev.minVelocity) return;
		const vel = msg.on ? applyCurve(msg.vel, dev.curve) : 0;
		if (latency != null) this.lastLatency = latency;
		this.emitNote(midi, msg.on, vel, "device", name, latency);
	}

	/** On-screen keys and the computer keyboard. */
	screen(midi, on, vel = 90) {
		this.emitNote(midi, on, vel, "screen", null, null);
	}

	emitNote(midi, on, vel, source, device, latency) {
		if (on) this.held.add(midi);
		else this.held.delete(midi);
		this.dispatchEvent(new CustomEvent("note", { detail: { midi, on, vel, source, device, latency } }));
	}

	/** Send a short message to the chosen output (Web MIDI), or to USB/BLE devices. */
	send(bytes) {
		const out = getSettings().midiOut;
		if (out) this.web.send(out, bytes);
	}

	sendNote(midi, on, vel = 80) {
		this.send(on ? [0x90, midi, vel] : [0x80, midi, 0]);
	}

	localControl(on) {
		const bytes = [0xb0, 122, on ? 127 : 0];
		for (const o of this.outputs()) this.web.send(o.id, bytes);
		this.usb.send(null, bytes);
	}

	allNotesOff() {
		for (let ch = 0; ch < 16; ch++) {
			const bytes = [0xb0 | ch, 123, 0];
			for (const o of this.outputs()) this.web.send(o.id, bytes);
		}
		this.usb.send(null, [0xb0, 123, 0]);
	}
}
