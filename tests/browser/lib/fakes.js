// Fake MIDI, Bluetooth and USB devices, injected into pages before any app script runs
// (page.addInitScript). Lets the browser tests drive every input path without hardware:
//   window.__fakeMidi.press(note, vel?), .release(note), .cc(n, value)
//   window.__fakeBle.packet([bytes])      after the page connected to "Fake BLE Piano"
//   window.__fakeUsb.packet([bytes])      after the page connected to "Fake USB Piano"
//   microphone: getUserMedia returns a sine tone at window.__fakeMicHz (default 440 Hz, A4)
// mode: "granted" (permission already given, auto-connects), "prompt", "denied", "unsupported"

export function fakeDevices(mode) {
	const listeners = [];
	const input = {
		id: "fake-in",
		name: "Fake Piano",
		manufacturer: "Test",
		state: "connected",
		connection: "open",
		addEventListener: (type, fn) => type === "midimessage" && listeners.push(fn),
	};
	const sent = [];
	const output = { id: "fake-out", name: "Fake Piano", manufacturer: "Test", state: "connected", send: (bytes) => sent.push(Array.from(bytes)) };
	const access = { inputs: new Map([["fake-in", input]]), outputs: new Map([["fake-out", output]]), addEventListener() {}, sysexEnabled: false };
	const emit = (bytes) => {
		const ev = { data: new Uint8Array(bytes), timeStamp: performance.now() };
		for (const fn of listeners) fn(ev);
	};
	window.__fakeMidi = {
		press: (note, vel = 90) => emit([0x90, note, vel]),
		release: (note) => emit([0x80, note, 0]),
		cc: (n, value) => emit([0xb0, n, value]),
		sent,
	};
	if (mode === "unsupported") {
		try {
			delete Navigator.prototype.requestMIDIAccess;
		} catch {
			/* ignore */
		}
		Object.defineProperty(navigator, "requestMIDIAccess", { value: undefined, configurable: true });
		delete navigator.requestMIDIAccess;
	} else {
		navigator.requestMIDIAccess = () => (mode === "denied" ? Promise.reject(new DOMException("blocked", "SecurityError")) : Promise.resolve(access));
		const realQuery = navigator.permissions?.query?.bind(navigator.permissions);
		if (navigator.permissions)
			navigator.permissions.query = (desc) =>
				desc?.name === "midi" ? Promise.resolve({ state: mode === "granted" ? "granted" : mode === "denied" ? "denied" : "prompt" }) : realQuery(desc);
	}

	// Web Bluetooth BLE-MIDI device
	let bleHandler = null;
	const characteristic = {
		startNotifications: async () => characteristic,
		addEventListener: (type, fn) => type === "characteristicvaluechanged" && (bleHandler = fn),
		writeValueWithoutResponse: async () => {},
	};
	const bleDevice = {
		name: "Fake BLE Piano",
		addEventListener() {},
		gatt: { connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) }) },
	};
	Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: async () => bleDevice }, configurable: true });
	window.__fakeBle = { packet: (bytes) => bleHandler?.({ target: { value: new DataView(new Uint8Array(bytes).buffer) } }) };

	// WebUSB vendor-class device with bulk endpoints (USB-MIDI packets)
	const queue = [];
	let waiting = null;
	const usbDevice = {
		productName: "Fake USB Piano",
		opened: false,
		configuration: {
			interfaces: [
				{
					interfaceNumber: 0,
					alternates: [
						{
							alternateSetting: 0,
							interfaceClass: 255,
							interfaceSubclass: 0,
							endpoints: [
								{ direction: "in", type: "bulk", endpointNumber: 2, packetSize: 64 },
								{ direction: "out", type: "bulk", endpointNumber: 1, packetSize: 64 },
							],
						},
					],
				},
			],
		},
		open: async () => {
			// Like Chromium on Linux when the kernel MIDI driver already holds the device.
			if (window.__fakeUsbInUse) throw new DOMException("Access denied.", "SecurityError");
			usbDevice.opened = true;
		},
		selectConfiguration: async () => {},
		claimInterface: async () => {},
		selectAlternateInterface: async () => {},
		transferIn: () =>
			new Promise((resolve) => {
				if (queue.length) resolve({ data: new DataView(new Uint8Array(queue.shift()).buffer) });
				else waiting = resolve;
			}),
		transferOut: async () => ({ status: "ok" }),
	};
	Object.defineProperty(navigator, "usb", { value: { requestDevice: async () => usbDevice, getDevices: async () => [] }, configurable: true });
	window.__fakeUsb = {
		packet: (bytes) => {
			if (waiting) {
				const w = waiting;
				waiting = null;
				w({ data: new DataView(new Uint8Array(bytes).buffer) });
			} else queue.push(bytes);
		},
	};
	// A "microphone" that hears a steady tone, made with Web Audio inside the page.
	if (navigator.mediaDevices) {
		navigator.mediaDevices.getUserMedia = async () => {
			const ac = new AudioContext();
			const osc = ac.createOscillator();
			osc.frequency.value = window.__fakeMicHz ?? 440;
			const dest = ac.createMediaStreamDestination();
			osc.connect(dest);
			osc.start();
			await ac.resume().catch(() => {});
			return dest.stream;
		};
	}
}
