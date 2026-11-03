// Device adapters. Each one reports raw MIDI messages to `onMessage({ key, name, data, ts })`
// and changes to `onChange()`. Browser-only.
//   WebMidiSource : Web MIDI API (USB class-compliant, OS-paired Bluetooth, virtual ports)
//   BleMidiSource : Bluetooth LE MIDI straight from the browser (Web Bluetooth, experimental)
//   UsbMidiSource : vendor-mode USB keyboards via WebUSB with standard USB-MIDI packets (experimental)
import { parseBleMidiPacket, parseUsbMidiPackets, usbMidiPacket } from "./parse.js";

export class WebMidiSource {
	constructor(onMessage, onChange) {
		this.onMessage = onMessage;
		this.onChange = onChange;
		this.access = null;
		this.supported = typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
	}

	/** "granted" | "prompt" | "denied" | "unsupported" without prompting the user. */
	async permission() {
		if (!this.supported) return "unsupported";
		try {
			const p = await navigator.permissions.query({ name: "midi", sysex: false });
			return p.state;
		} catch {
			return "prompt";
		}
	}

	async open() {
		if (!this.supported) throw Object.assign(new Error("unsupported"), { code: "unsupported" });
		if (!this.access) {
			this.access = await navigator.requestMIDIAccess({ sysex: false });
			this.access.addEventListener("statechange", () => {
				this.attach();
				this.onChange();
			});
		}
		this.attach();
		this.onChange();
	}

	attach() {
		for (const input of this.access?.inputs.values() ?? []) {
			if (input.__nt) continue;
			input.__nt = true;
			const key = `${input.name}|${input.manufacturer || ""}`;
			input.addEventListener("midimessage", (e) => this.onMessage({ key, name: input.name || "MIDI", data: e.data, ts: e.timeStamp }));
		}
	}

	inputs() {
		return [...(this.access?.inputs.values() ?? [])].map((i) => ({ id: i.id, key: `${i.name}|${i.manufacturer || ""}`, name: i.name || "MIDI", state: i.state }));
	}

	outputs() {
		return [...(this.access?.outputs.values() ?? [])].map((o) => ({ id: o.id, name: o.name || "MIDI", state: o.state }));
	}

	send(outputId, bytes) {
		this.access?.outputs.get(outputId)?.send(bytes);
	}
}

const BLE_SERVICE = "03b80e5a-ede8-4b33-a751-6ce34ec4c700";
const BLE_CHAR = "7772e5db-3868-4112-a1a9-f2669d106bf3";

export class BleMidiSource {
	constructor(onMessage, onChange) {
		this.onMessage = onMessage;
		this.onChange = onChange;
		this.devices = [];
		this.supported = typeof navigator !== "undefined" && "bluetooth" in navigator;
	}

	async connect() {
		if (!this.supported) throw Object.assign(new Error("unsupported"), { code: "unsupported" });
		const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_SERVICE] }] });
		const server = await device.gatt.connect();
		const service = await server.getPrimaryService(BLE_SERVICE);
		const ch = await service.getCharacteristic(BLE_CHAR);
		await ch.startNotifications();
		const key = `${device.name || "BLE"}|ble`;
		ch.addEventListener("characteristicvaluechanged", (e) => {
			const bytes = new Uint8Array(e.target.value.buffer);
			for (const msg of parseBleMidiPacket(bytes)) this.onMessage({ key, name: device.name || "Bluetooth MIDI", data: msg, ts: performance.now() });
		});
		device.addEventListener("gattserverdisconnected", () => {
			this.devices = this.devices.filter((d) => d.device !== device);
			this.onChange();
		});
		this.devices.push({ device, ch, key, name: device.name || "Bluetooth MIDI" });
		this.onChange();
	}

	inputs() {
		return this.devices.map((d) => ({ id: d.key, key: d.key, name: d.name, state: "connected" }));
	}

	send(_id, bytes) {
		// BLE-MIDI write: header + timestamp + message.
		for (const d of this.devices) d.ch.writeValueWithoutResponse?.(new Uint8Array([0x80, 0x80, ...bytes])).catch(() => {});
	}
}

/** Vendor ids of makers whose older keyboards use a vendor USB class with USB-MIDI packets. */
export const USB_VENDORS = [0x0499 /* Yamaha */, 0x0582 /* Roland */, 0x0944 /* Korg */, 0x07cf /* Casio */, 0x0f54 /* Kawai */];

export class UsbMidiSource {
	constructor(onMessage, onChange) {
		this.onMessage = onMessage;
		this.onChange = onChange;
		this.devices = [];
		this.supported = typeof navigator !== "undefined" && "usb" in navigator;
	}

	async connect() {
		if (!this.supported) throw Object.assign(new Error("unsupported"), { code: "unsupported" });
		const device = await navigator.usb.requestDevice({ filters: USB_VENDORS.map((vendorId) => ({ vendorId })) });
		await this.open(device);
	}

	/** Reopen devices the user already allowed (no prompt). */
	async reconnect() {
		if (!this.supported) return;
		for (const device of await navigator.usb.getDevices()) await this.open(device).catch(() => {});
	}

	async open(device) {
		await device.open();
		if (device.configuration === null) await device.selectConfiguration(1);
		let found = null;
		for (const iface of device.configuration.interfaces) {
			for (const alt of iface.alternates) {
				const vendorOrMidi = alt.interfaceClass === 255 || (alt.interfaceClass === 1 && alt.interfaceSubclass === 3);
				const epIn = alt.endpoints.find((e) => e.direction === "in" && e.type === "bulk");
				const epOut = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
				if (vendorOrMidi && epIn) {
					found = { iface, alt, epIn, epOut };
					break;
				}
			}
			if (found) break;
		}
		if (!found) throw Object.assign(new Error("no MIDI endpoints"), { code: "no-endpoints" });
		await device.claimInterface(found.iface.interfaceNumber);
		if (found.iface.alternates.length > 1) await device.selectAlternateInterface(found.iface.interfaceNumber, found.alt.alternateSetting);
		const name = device.productName || "USB MIDI";
		const key = `${name}|usb`;
		const entry = { device, key, name, epOut: found.epOut?.endpointNumber };
		this.devices.push(entry);
		this.onChange();
		(async () => {
			try {
				while (device.opened) {
					const r = await device.transferIn(found.epIn.endpointNumber, found.epIn.packetSize || 64);
					if (r.data) for (const msg of parseUsbMidiPackets(new Uint8Array(r.data.buffer))) this.onMessage({ key, name, data: msg, ts: performance.now() });
				}
			} catch {
				// Unplugged or closed: drop the device.
			}
			this.devices = this.devices.filter((d) => d !== entry);
			this.onChange();
		})();
	}

	inputs() {
		return this.devices.map((d) => ({ id: d.key, key: d.key, name: d.name, state: "connected" }));
	}

	send(_id, bytes) {
		for (const d of this.devices) if (d.epOut) d.device.transferOut(d.epOut, new Uint8Array(usbMidiPacket(bytes))).catch(() => {});
	}
}
