// Devices: connect MIDI (Web MIDI, Bluetooth, USB vendor mode) or the microphone, choose inputs and output,
// per-device settings (keyboard size, control keys), key lights on the MIDI output, Local
// Control and All Notes Off, a stream link builder, a live MIDI monitor, latency, and a
// copyable device report for GitHub (device names and message types only).
import { getDeviceSettings, getSettings, saveDeviceSettings, saveSettings } from "../core/store.js";
import { midiLabel } from "../core/notes.js";
import { KEYBOARD_SIZES, knownKeyboardSize } from "../core/keyboard-layout.js";
import { KeyLights } from "../core/key-lights.js";
import * as icons from "../content/icons.js";
import { $, boot, el, toggleMic } from "./common.js";

const ctx = await boot();
const { t, hub, noteNames } = ctx;
const lights = new KeyLights(hub);
const root = $("#app-root");

const midiBox = el("section", { "aria-labelledby": "midi-h" });
const micBox = el("section", { "aria-labelledby": "mic-h" });
const micStatus = el("p", { role: "status" });
const bleBox = el("section", { "aria-labelledby": "ble-h" });
const usbBox = el("section", { "aria-labelledby": "usb-h" });
const streamBox = el("section", { "aria-labelledby": "stream-h" });
const settingsBox = el("section", { "aria-labelledby": "dev-settings-h" });
const monitor = el("ul", { className: "monitor", "aria-label": t("devicesPage.monitorHeading") });
const rangeLine = el("p", {});
const latencyLine = el("p", { role: "status" });
const report = el("textarea", { id: "device-report", rows: "8", readonly: true, className: "monitor" });
const copyBtn = el("button", { type: "button", className: "btn", icon: icons.copy, text: t("devicesPage.reportCopy") });
const copyStatus = el("p", { role: "status" });
const seen = new Map();

root.append(
	midiBox,
	micBox,
	settingsBox,
	bleBox,
	usbBox,
	streamBox,
	el("section", { "aria-labelledby": "mon-h" }, el("h2", { id: "mon-h", text: t("devicesPage.monitorHeading") }), el("p", { text: t("devicesPage.monitorIntro") }), monitor, rangeLine),
	el("section", { "aria-labelledby": "lat-h" }, el("h2", { id: "lat-h", text: t("devicesPage.latencyHeading") }), el("p", { text: t("devicesPage.latencyIntro") }), latencyLine),
	el(
		"section",
		{ "aria-labelledby": "rep-h" },
		el("h2", { id: "rep-h", text: t("devicesPage.reportHeading") }),
		el("p", { text: t("devicesPage.reportIntro") }),
		el("label", { for: "device-report", className: "visually-hidden", text: t("devicesPage.reportHeading") }),
		report,
		el("div", { className: "actions" }, copyBtn, el("a", { className: "btn", href: `${ctx.cfg.sourceUrl}/issues/new?template=device-report.yml`, icon: /^https:\/\/github\.com\//.test(ctx.cfg.sourceUrl) ? icons.githubLogo : null, text: t("devicesPage.reportLink") })),
		copyStatus,
	),
);

function select(id, options, value, onChange) {
	const s = el("select", { id });
	for (const [v, label] of options) s.append(el("option", { value: String(v), text: label }));
	s.value = String(value);
	s.addEventListener("change", () => onChange(s.value));
	return s;
}

function renderMidi() {
	const inputs = hub.inputs().filter((i) => i.kind !== "mic");
	const settings = getSettings();
	const parts = [el("h2", { id: "midi-h", text: t("devicesPage.midiHeading") }), el("p", { text: t("devicesPage.midiIntro") })];
	if (!hub.web.supported) parts.push(el("p", { className: "notice", text: t("device.unsupported") }));
	else if (!hub.web.access) {
		const b = el("button", { type: "button", className: "btn btn-primary", icon: icons.plugs, text: t("device.connect") });
		b.addEventListener("click", () => hub.connectMidi().catch(() => {}).finally(renderAll));
		parts.push(el("div", { className: "actions" }, b));
	}
	if (inputs.length) {
		const fs = el("fieldset", {}, el("legend", { text: t("devicesPage.inputs") }));
		for (const i of inputs) {
			const cb = el("input", { type: "checkbox" });
			cb.checked = !settings.inputsOff.includes(i.key);
			cb.addEventListener("change", () => {
				const off = new Set(getSettings().inputsOff);
				if (cb.checked) off.delete(i.key);
				else off.add(i.key);
				saveSettings({ inputsOff: [...off] });
			});
			fs.append(el("label", { className: "check" }, cb, t("devicesPage.use", { name: i.name })));
		}
		parts.push(fs);
	}
	const outs = hub.outputs();
	if (outs.length) {
		parts.push(
			el(
				"div",
				{ className: "field" },
				el("label", { for: "midi-out", text: t("devicesPage.outputs") }),
				select("midi-out", [["", t("devicesPage.outputNone")], ...outs.map((o) => [o.id, o.name])], settings.midiOut, (v) => saveSettings({ midiOut: v })),
			),
		);
		const off = el("button", { type: "button", className: "btn", text: t("devicesPage.localOff") });
		off.addEventListener("click", () => hub.localControl(false));
		const on = el("button", { type: "button", className: "btn", text: t("devicesPage.localOn") });
		on.addEventListener("click", () => hub.localControl(true));
		const panic = el("button", { type: "button", className: "btn", icon: icons.handPalm, text: t("devicesPage.allNotesOff") });
		panic.addEventListener("click", () => hub.allNotesOff());
		parts.push(el("div", { className: "actions" }, off, on, panic));
		parts.push(renderKeyLights(settings));
	}
	midiBox.replaceChildren(...parts);
}

// Key lights (experimental): the next notes are sent to the chosen output on one channel.
function renderKeyLights(settings) {
	const k = settings.keyLights ?? { on: false, channel: 1 };
	const on = el("input", { type: "checkbox", id: "key-lights" });
	on.checked = k.on === true;
	on.addEventListener("change", () => saveSettings({ keyLights: { ...getSettings().keyLights, on: on.checked } }));
	const channel = select(
		"key-lights-channel",
		Array.from({ length: 16 }, (_, i) => [i + 1, String(i + 1)]),
		k.channel ?? 1,
		(v) => saveSettings({ keyLights: { ...getSettings().keyLights, channel: Number(v) } }),
	);
	const test = el("button", { type: "button", className: "btn", text: t("devicesPage.keyLightsTest") });
	test.addEventListener("click", () => lights.test(60));
	return el(
		"fieldset",
		{},
		el("legend", { text: t("devicesPage.keyLightsHeading") }),
		el("p", { className: "hint", text: t("devicesPage.keyLightsIntro") }),
		el("label", { className: "check" }, on, t("devicesPage.keyLights")),
		el("div", { className: "field" }, el("label", { for: "key-lights-channel", text: t("devicesPage.keyLightsChannel") }), channel),
		el("div", { className: "actions" }, test),
	);
}

// Control keys: two keys of the instrument start or stop practice and restart it.
function controlKeys(i, id) {
	const keys = getDeviceSettings(i.key).controlKeys;
	const status = el("p", { role: "status", text: keys ? t("devicesPage.controlSet", { toggle: midiLabel(keys.toggle, noteNames), restart: midiLabel(keys.restart, noteNames) }) : t("devicesPage.controlNone") });
	const teach = el("button", { type: "button", className: "btn", id: `${id}-teach`, text: t("devicesPage.controlTeach") });
	const remove = el("button", { type: "button", className: "btn", icon: icons.trash, text: t("devicesPage.controlRemove"), hidden: !keys });
	teach.addEventListener("click", () => {
		status.textContent = t("devicesPage.controlPressToggle");
		hub.learnNext(({ key, raw: toggle }) => {
			if (key !== i.key) return void (status.textContent = t("devicesPage.controlOtherDevice"));
			status.textContent = t("devicesPage.controlPressRestart");
			hub.learnNext(({ key: k2, raw: restart }) => {
				if (k2 !== i.key || restart === toggle) return void (status.textContent = t("devicesPage.controlOtherDevice"));
				saveDeviceSettings(i.key, { controlKeys: { toggle, restart } });
				renderDeviceSettings();
				$(`#${id}-teach`)?.focus();
			});
		});
	});
	remove.addEventListener("click", () => {
		saveDeviceSettings(i.key, { controlKeys: null });
		renderDeviceSettings();
		$(`#${id}-teach`)?.focus();
	});
	return el("fieldset", {}, el("legend", { text: t("devicesPage.controlHeading") }), el("p", { className: "hint", text: t("devicesPage.controlIntro") }), status, el("div", { className: "actions" }, teach, remove));
}

function renderDeviceSettings() {
	const inputs = hub.inputs().filter((i) => i.kind !== "mic");
	const parts = [el("h2", { id: "dev-settings-h", text: t("devicesPage.settingsHeading") })];
	if (!inputs.length) parts.push(el("p", { text: t("device.statusNone") }));
	inputs.forEach((i, idx) => {
		const s = getDeviceSettings(i.key);
		const id = (k) => `dev-${idx}-${k}`;
		const save = (k, cast = Number) => (v) => saveDeviceSettings(i.key, { [k]: cast(v) });
		const fs = el(
			"fieldset",
			{},
			el("legend", { text: i.name }),
			el("div", { className: "field" }, el("label", { for: id("ch"), text: t("devicesPage.channel") }), select(id("ch"), [[0, t("devicesPage.channelAll")], ...Array.from({ length: 16 }, (_, n) => [n + 1, String(n + 1)])], s.channel, save("channel"))),
			el("div", { className: "field" }, el("label", { for: id("oct"), text: t("devicesPage.octave") }), select(id("oct"), [-2, -1, 0, 1, 2].map((n) => [n, n > 0 ? `+${n}` : String(n)]), s.octave, save("octave"))),
			el("div", { className: "field" }, el("label", { for: id("tr"), text: t("devicesPage.transpose") }), select(id("tr"), Array.from({ length: 25 }, (_, n) => [n - 12, n - 12 > 0 ? `+${n - 12}` : String(n - 12)]), s.transpose, save("transpose"))),
			el(
				"div",
				{ className: "field" },
				el("label", { for: id("cv"), text: t("devicesPage.velocity") }),
				select(id("cv"), [["linear", t("devicesPage.velocityLinear")], ["soft", t("devicesPage.velocitySoft")], ["hard", t("devicesPage.velocityHard")]], s.curve, save("curve", String)),
			),
			el("div", { className: "field" }, el("label", { for: id("mv"), text: t("devicesPage.minVelocity") }), select(id("mv"), [1, 5, 10, 20, 30].map((n) => [n, String(n)]), s.minVelocity, save("minVelocity"))),
			el("div", { className: "field" }, el("label", { for: id("sp"), text: t("devicesPage.split") }), select(id("sp"), [48, 53, 55, 57, 60, 62, 64, 65, 67].map((m) => [m, midiLabel(m, noteNames)]), s.split, save("split"))),
			el(
				"div",
				{ className: "field" },
				el("label", { for: id("keys"), text: t("devicesPage.keys") }),
				select(
					id("keys"),
					// 0 = "I do not know" chosen on purpose (no warning, even for a known model); null = not set yet.
					[[0, t("devicesPage.keysUnknown")], ...Object.entries(KEYBOARD_SIZES).map(([n, [lo, hi]]) => [n, t("devicesPage.keysOption", { n, low: midiLabel(lo, noteNames), high: midiLabel(hi, noteNames) })])],
					s.keys ?? knownKeyboardSize(i.name) ?? 0,
					save("keys"),
				),
				el("p", { className: "hint", text: t("devicesPage.keysHint") }),
			),
		);
		fs.append(controlKeys(i, id("control")));
		parts.push(fs);
	});
	settingsBox.replaceChildren(...parts);
}

function renderExperimental(box, idH, heading, intro, label, supported, connect) {
	const parts = [el("h2", { id: idH, text: heading }), el("p", { text: intro })];
	if (!supported) parts.push(el("p", { className: "notice", text: t("devicesPage.unsupportedApi") }));
	else {
		const b = el("button", { type: "button", className: "btn", icon: icons.plugs, text: label });
		const out = el("p", { role: "status" });
		b.addEventListener("click", async () => {
			try {
				await connect();
				renderAll();
			} catch (e) {
				// NotFoundError = the user closed the device chooser. SecurityError ("Access denied")
				// = the operating system's MIDI driver already holds the device (Linux, or Windows with
				// the maker's driver): Web MIDI is the right path there, so say that in plain words.
				if (e?.name === "NotFoundError") return;
				out.textContent = e?.name === "SecurityError" || /access denied/i.test(e?.message ?? "") ? t("devicesPage.usbInUse") : t("devicesPage.connectFailed", { error: e?.message || String(e) });
			}
		});
		parts.push(el("div", { className: "actions" }, b), out);
	}
	box.replaceChildren(...parts);
}

function renderReport() {
	const counts = [...seen].map(([k, n]) => `${k}: ${n}`).join(", ") || "-";
	report.value = [
		`App: Nuottitreeni ${ctx.cfg.version}`,
		`Browser: ${navigator.userAgent}`,
		`Web MIDI: ${hub.web.supported ? "yes" : "no"}, Web Bluetooth: ${hub.ble.supported ? "yes" : "no"}, WebUSB: ${hub.usb.supported ? "yes" : "no"}`,
		`Status: ${hub.state}`,
		`Inputs: ${hub.inputs().map((i) => i.name).join(", ") || "-"}`,
		`Outputs: ${hub.outputs().map((o) => o.name).join(", ") || "-"}`,
		`Messages seen: ${counts}`,
		`Range: ${hub.range.min ?? "-"} to ${hub.range.max ?? "-"}`,
	].join("\n");
}

function renderMic() {
	const parts = [el("h2", { id: "mic-h", text: t("devicesPage.micHeading") }), el("p", { text: t("devicesPage.micIntro") }), el("p", { text: t("devicesPage.micLimits") })];
	if (!hub.mic.supported) parts.push(el("p", { className: "notice", text: t("devicesPage.micUnsupported") }));
	else {
		const b = el("button", { type: "button", id: "mic-toggle", className: "btn", icon: icons.microphone, text: hub.mic.active ? t("devicesPage.micStop") : t("devicesPage.micStart") });
		b.addEventListener("click", () =>
			toggleMic(ctx)
				.then(() => (micStatus.textContent = hub.mic.active ? t("devicesPage.micListening") : ""))
				.catch((e) => (micStatus.textContent = e?.code === "unsupported" ? t("devicesPage.micUnsupported") : t("devicesPage.micDenied")))
				.finally(renderAll),
		);
		parts.push(el("div", { className: "actions" }, b), micStatus);
	}
	micBox.replaceChildren(...parts);
}

// Builds the stream page link (?bg=&names=1), so nobody has to type URL options by hand.
function renderStream() {
	const link = el("a", { className: "btn", icon: icons.pianoKeys, text: t("devicesPage.streamOpen") });
	const bg = select("stream-bg", [["green", t("stream.bgGreen")], ["black", t("stream.bgBlack")], ["transparent", t("stream.bgTransparent")]], "green", update);
	const names = el("input", { type: "checkbox", id: "stream-names" });
	names.addEventListener("change", update);
	function update() {
		link.href = `${ctx.paths.stream}?bg=${bg.value}${names.checked ? "&names=1" : ""}`;
	}
	update();
	streamBox.replaceChildren(
		el("h2", { id: "stream-h", text: t("stream.title") }),
		el("p", { text: t("devicesPage.streamIntro") }),
		el("div", { className: "field" }, el("label", { for: "stream-bg", text: t("stream.background") }), bg),
		el("label", { className: "check" }, names, t("devicesPage.streamNames")),
		el("div", { className: "actions" }, link),
	);
}

function renderAll() {
	renderMidi();
	renderMic();
	renderDeviceSettings();
	renderExperimental(bleBox, "ble-h", t("devicesPage.bleHeading"), t("devicesPage.bleIntro"), t("devicesPage.bleConnect"), hub.ble.supported, () => hub.connectBle());
	renderExperimental(usbBox, "usb-h", t("devicesPage.usbHeading"), t("devicesPage.usbIntro"), t("devicesPage.usbConnect"), hub.usb.supported, () => hub.connectUsb());
	renderReport();
}

hub.addEventListener("status", renderAll);
hub.addEventListener("note", (e) => {
	if (e.detail.source === "mic" && e.detail.on) micStatus.textContent = t("devicesPage.micHeard", { name: midiLabel(e.detail.midi, noteNames) });
});
hub.addEventListener("message", (e) => {
	const { device, text } = e.detail;
	const type = text.slice(0, 1);
	const name = { 8: "note off", 9: "note on", b: "control change", c: "program change", e: "pitch bend", f: "system" }[type] || "other";
	seen.set(name, (seen.get(name) ?? 0) + 1);
	monitor.prepend(el("li", { text: `${device}: ${text}` }));
	while (monitor.children.length > 30) monitor.lastChild.remove();
	if (hub.range.min != null) rangeLine.textContent = t("devicesPage.range", { low: midiLabel(hub.range.min, noteNames), high: midiLabel(hub.range.max, noteNames) });
	if (hub.lastLatency != null) latencyLine.textContent = t("devicesPage.latencyResult", { ms: Math.round(hub.lastLatency) });
	renderReport();
});
copyBtn.addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(report.value);
		copyStatus.textContent = t("devicesPage.reportCopied");
	} catch {
		report.select();
	}
});
monitor.append(el("li", { text: t("devicesPage.monitorEmpty") }));
renderStream();
renderAll();
