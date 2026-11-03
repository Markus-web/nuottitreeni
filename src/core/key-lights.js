// Key lights (experimental): keyboards with lighted keys light a key when they receive a
// note-on on a certain MIDI channel, which differs by maker. When the "keyLights" setting is on,
// the next notes of a wait-mode exercise are sent to the chosen MIDI output on that channel
// (low velocity, so a keyboard that plays them is quiet) and switched off when they pass.
import { getSettings } from "./store.js";

export class KeyLights {
	/** hub: InputHub (its send() goes to the chosen MIDI output). */
	constructor(hub) {
		this.hub = hub;
		this.lit = new Set();
	}

	get config() {
		const k = getSettings().keyLights ?? {};
		return { on: k.on === true && !!getSettings().midiOut, channel: Math.min(16, Math.max(1, Number(k.channel) || 1)) - 1 };
	}

	/** Light exactly these MIDI notes (an empty list switches every light off). */
	show(midis) {
		const { on, channel } = this.config;
		const next = new Set(on ? midis : []);
		for (const m of this.lit) if (!next.has(m)) this.hub.send([0x80 | channel, m, 0]);
		for (const m of next) if (!this.lit.has(m)) this.hub.send([0x90 | channel, m, 1]);
		this.lit = next;
	}

	clear() {
		const { channel } = this.config;
		for (const m of this.lit) this.hub.send([0x80 | channel, m, 0]);
		this.lit.clear();
	}

	/** Light one key for a second (the test button on the Devices page). */
	test(midi = 60) {
		const { channel } = this.config;
		this.hub.send([0x90 | channel, midi, 1]);
		setTimeout(() => this.hub.send([0x80 | channel, midi, 0]), 1000);
	}
}
