// Shared start-up for every page: config, translations, theme, device status in the header,
// sound, recorder, sync, service worker and banners. Pages call boot() and get a context.
import { fmt, makeT } from "../core/i18n.js";
import { InputHub } from "../core/input/hub.js";
import { Recorder } from "../core/recorder.js";
import { Sound } from "../core/sound.js";
import { getSettings, saveSettings, storageAvailable } from "../core/store.js";
import { SyncClient } from "../core/sync.js";
import { svgIcon } from "../core/icon.js";
import { NOTE_NAME_SYSTEMS } from "../core/notes.js";

export const $ = (sel, root = document) => root.querySelector(sel);

/**
 * Create an element: el("p", { className: "x", text: "..." }, child...)
 * icon: an export of ../content/icons.js (pages import it as `* as icons`), drawn before the
 * text; decorative and aria-hidden.
 */
export function el(tag, props = {}, ...children) {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(props)) {
		if (v == null || v === false || k === "icon") continue;
		if (k === "text") node.textContent = v;
		else if (k === "className") node.className = v;
		else if (k === "dataset") Object.assign(node.dataset, v);
		else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
		else if (v === true) node.setAttribute(k, "");
		else node.setAttribute(k, String(v));
	}
	for (const c of children.flat()) if (c != null) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
	if (props.icon) node.insertAdjacentHTML("afterbegin", svgIcon(props.icon));
	return node;
}

/** Replace a control's icon and text in one step (toggles such as Play / Stop). */
export function setLabel(node, icon, text) {
	node.textContent = text;
	if (icon) node.insertAdjacentHTML("afterbegin", svgIcon(icon));
}

function readConfig() {
	try {
		return JSON.parse(document.getElementById("nt-config").textContent);
	} catch {
		return {};
	}
}

function applyTheme(theme) {
	if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
	else delete document.documentElement.dataset.theme;
}

function banner(ctx, children, { lang } = {}) {
	const box = el("div", { className: "banner", lang }, ...children);
	$("#banners")?.append(box);
	return box;
}

function setupTheme(ctx) {
	const tools = $("[data-theme-tools]");
	const select = $("#theme-select");
	if (!tools || !select) return;
	tools.hidden = false;
	select.value = getSettings().theme;
	select.addEventListener("change", () => {
		saveSettings({ theme: select.value });
		applyTheme(select.value);
		dispatchEvent(new CustomEvent("nt-theme"));
	});
}

function setupDeviceStatus(ctx) {
	const { hub, t } = ctx;
	const status = $("#device-status");
	const button = $("#device-connect");
	const mic = $("#mic-toggle");
	const render = ({ state, names }) => {
		if (!status) return;
		status.dataset.state = state === "connected" ? "on" : "off";
		status.textContent =
			state === "connected"
				? names.length === 1
					? t("device.statusConnected", { name: names[0] })
					: t("device.statusMany", { n: names.length })
				: state === "connecting"
					? t("device.statusConnecting")
					: state === "unsupported"
						? t("device.unsupported")
						: state === "denied"
							? t("device.denied")
							: state === "none-found"
								? t("device.noDevices")
								: t("device.statusNone");
		if (button) button.hidden = !hub.web.supported || state === "connecting" || hub.web.inputs().some((i) => i.state === "connected");
		if (mic) {
			mic.hidden = !hub.mic.supported;
			mic.setAttribute("aria-pressed", String(hub.mic.active));
		}
	};
	hub.addEventListener("status", (e) => render(e.detail));
	render({ state: hub.state, names: [] });
	button?.addEventListener("click", () => {
		ctx.sound.unlock();
		hub.connectMidi().catch(() => {});
	});
	mic?.addEventListener("click", () => toggleMic(ctx).catch(() => {}));
	// The microphone was on on the previous page: restart it without asking again.
	if (getSettings().micOn && hub.mic.supported) hub.mic.permission().then((p) => p === "granted" && hub.startMic(t("device.mic")).catch(() => {}));
}

/** Microphone on or off (header button and the Devices page). Remembers the choice. */
export async function toggleMic(ctx) {
	const { hub, t } = ctx;
	if (hub.mic.active) {
		hub.stopMic();
		saveSettings({ micOn: false });
		return;
	}
	try {
		await hub.startMic(t("device.mic"));
		saveSettings({ micOn: true });
	} catch (e) {
		const status = $("#device-status");
		if (status) status.textContent = e?.code === "unsupported" ? t("devicesPage.micUnsupported") : t("devicesPage.micDenied");
		throw e;
	}
}

function setupServiceWorker(ctx) {
	if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
	// Register after the page has loaded and settled, so caching never competes with the first paint.
	const start = () => setTimeout(() => registerWorker(ctx), 2000);
	if (document.readyState === "complete") start();
	else addEventListener("load", start, { once: true });
}

function registerWorker(ctx) {
	const { t } = ctx;
	navigator.serviceWorker
		.register("/sw.js")
		.then((reg) => {
			const offerUpdate = (worker) => {
				if (!worker || !navigator.serviceWorker.controller) return;
				const btn = el("button", { type: "button", className: "btn btn-primary", text: t("common.updateNow") });
				btn.addEventListener("click", () => {
					ctx.updateRequested = true;
					worker.postMessage({ type: "skip-waiting" });
				});
				banner(ctx, [el("p", { role: "status", text: t("common.updateReady") }), btn]);
			};
			if (reg.waiting) offerUpdate(reg.waiting);
			reg.addEventListener("updatefound", () => {
				const w = reg.installing;
				w?.addEventListener("statechange", () => {
					if (w.state === "installed") offerUpdate(w);
				});
			});
		})
		.catch(() => {});
	// Reload only after the user asked for the update; the first install also fires
	// controllerchange (clients.claim) and must not interrupt a lesson.
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (ctx.updateRequested) location.reload();
	});
}

function setupLanguageHints() {
	// Keep the query string (lesson id) when switching language on interactive pages. The
	// language link in the header is the only switch: a banner would shift the layout (CLS).
	if (location.search) for (const a of document.querySelectorAll("[data-lang-link]")) a.href = a.getAttribute("href") + location.search;
}

async function setupOperator(ctx) {
	if (ctx.cfg.operator) return;
	const targets = document.querySelectorAll("[data-operator-line], [data-operator-name], [data-operator-contact]");
	if (!targets.length) return;
	try {
		const res = await fetch("/api/config", { cache: "default" });
		const conf = await res.json();
		ctx.runtimeConfig = conf;
		for (const n of document.querySelectorAll("[data-operator-line]")) if (conf.operatorName) n.textContent = ctx.t("common.operator", { name: conf.operatorName });
		for (const n of document.querySelectorAll("[data-operator-name]")) if (conf.operatorName) n.textContent = conf.operatorName;
		for (const n of document.querySelectorAll("[data-operator-contact]")) {
			if (!conf.operatorContact) continue;
			const href = conf.operatorContact.includes("@") ? `mailto:${conf.operatorContact}` : conf.operatorContact;
			if (/^(mailto:|https:\/\/)/.test(href)) n.replaceWith(el("a", { href, text: conf.operatorContact }));
		}
	} catch {
		/* offline or API missing: keep the generic text */
	}
}

/** Boot the page. Returns the shared context used by page modules. */
export async function boot() {
	const cfg = readConfig();
	const lang = cfg.locale || document.documentElement.lang || "en";
	const { default: dict } = await import(`../content/locales/${lang}.js`);
	const t = makeT(dict, null);
	const f = fmt(dict.meta.tag);
	applyTheme(getSettings().theme);
	const hub = new InputHub();
	const sound = new Sound(cfg.samples);
	const recorder = new Recorder(hub);
	hub.mic.isMuted = () => sound.isSounding();
	const sync = new SyncClient();
	const chosenNames = getSettings().noteNames;
	const noteNames = NOTE_NAME_SYSTEMS.includes(chosenNames) ? chosenNames : dict.meta.noteNames;
	const ctx = { cfg, lang, dict, t, f, hub, sound, recorder, sync, paths: cfg.paths, noteNames, el, $ };

	// Audio may only start after a user gesture.
	const unlock = () => {
		sound.unlock();
		hub.mic.resume();
		(window.requestIdleCallback || ((fn) => setTimeout(fn, 1500)))(() => getSettings().sound && sound.preload());
	};
	addEventListener("pointerdown", unlock, { once: true, capture: true });
	addEventListener("keydown", unlock, { once: true, capture: true });

	hub.addEventListener("note", (e) => {
		const { midi, on, vel, source } = e.detail;
		const s = getSettings();
		// Microphone notes are never played back: the microphone would hear them again.
		if (source === "mic" || (source === "device" && !s.playIncoming)) return;
		if (on) sound.play(midi, vel);
		else sound.stop(midi);
	});
	hub.addEventListener("pedal", (e) => sound.setPedal(e.detail.down));
	addEventListener("nt-settings", (e) => sound.setVolume(e.detail.volume));

	setupTheme(ctx);
	setupDeviceStatus(ctx);
	setupServiceWorker(ctx);
	setupLanguageHints();
	setupOperator(ctx);
	if (!storageAvailable()) banner(ctx, [el("p", { role: "status", text: t("common.storageBlocked") })]);
	hub.init().catch(() => {});
	if (sync.state.code) sync.schedule(1500);
	return ctx;
}

/** Download a file made in the browser (export, recordings). */
export function download(name, data, type) {
	const blob = data instanceof Blob ? data : new Blob([data], { type });
	const url = URL.createObjectURL(blob);
	const a = el("a", { href: url, download: name });
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Move focus to a heading after an in-page view change (2.4.3), and update the title. */
export function focusHeading(node, title) {
	if (!node) return;
	if (title) document.title = title;
	node.setAttribute("tabindex", "-1");
	node.focus({ preventScroll: false });
}
