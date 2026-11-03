// Settings: sound, display, language, data export/import/delete, optional sync, offline status.
// Destructive actions (replace on import, delete local data, delete server data) use an
// in-page confirmation step (WCAG 3.3.6). Export/import use the progress v1 format.
import { CATALOG_IDS } from "../content/catalog.js";
import { aggregate, mergeProgress, pruneDevices, validateProgress } from "../core/progress.js";
import { clearAll, getJson, getProgress, getSettings, saveProgress, saveSettings, setJson } from "../core/store.js";
import * as icons from "../content/icons.js";
import { $, boot, download, el } from "./common.js";

const ctx = await boot();
const { t, f, sync, sound } = ctx;
const root = $("#app-root");

function section(id, title, ...children) {
	return el("section", { "aria-labelledby": id }, el("h2", { id, text: title }), ...children);
}
function check(label, key, onChange) {
	const input = el("input", { type: "checkbox" });
	input.checked = Boolean(getSettings()[key]);
	input.addEventListener("change", () => {
		saveSettings({ [key]: input.checked });
		onChange?.(input.checked);
	});
	return el("label", { className: "check" }, input, label);
}
function confirmStep(container, message, onYes) {
	const yes = el("button", { type: "button", className: "btn btn-primary", text: t("common.confirm") });
	const no = el("button", { type: "button", className: "btn", text: t("common.cancel") });
	const box = el("div", { className: "notice" }, el("p", { role: "alert", text: message }), el("div", { className: "actions" }, yes, no));
	container.append(box);
	no.focus();
	no.addEventListener("click", () => box.remove());
	yes.addEventListener("click", async () => {
		box.remove();
		await onYes();
	});
}

// ---- sound and display -----------------------------------------------------------------
const volume = el("input", { type: "range", id: "volume", min: "0", max: "1", step: "0.05", value: String(getSettings().volume) });
volume.addEventListener("input", () => saveSettings({ volume: Number(volume.value) }));
const testSound = el("button", { type: "button", className: "btn", icon: icons.speakerHigh, text: t("drill.listen") });
testSound.addEventListener("click", () => {
	sound.unlock();
	sound.play(60, 90);
	setTimeout(() => sound.stop(60), 700);
});
const themeSelect = el("select", { id: "settings-theme" });
for (const v of ["system", "dark", "light"]) themeSelect.append(el("option", { value: v, text: t(`theme.${v}`) }));
themeSelect.value = getSettings().theme;
themeSelect.addEventListener("change", () => {
	saveSettings({ theme: themeSelect.value });
	if (themeSelect.value === "system") delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = themeSelect.value;
	const footer = $("#theme-select");
	if (footer) footer.value = themeSelect.value;
});
const namesSelect = el("select", { id: "settings-note-names", "aria-describedby": "note-names-hint" });
for (const v of ["auto", "letters", "h-system", "solfege"]) namesSelect.append(el("option", { value: v, text: t(`settings.noteNamesOptions.${v}`) }));
namesSelect.value = getSettings().noteNames;
namesSelect.addEventListener("change", () => saveSettings({ noteNames: namesSelect.value }));
const langLinks = [...document.querySelectorAll("[data-lang-link]")].map((a) => el("li", {}, el("a", { className: "standalone", href: a.getAttribute("href"), lang: a.getAttribute("lang"), hreflang: a.getAttribute("hreflang"), text: a.textContent })));

root.append(
	section(
		"sound-h",
		t("settings.soundHeading"),
		check(t("settings.sound"), "sound"),
		el("div", { className: "field" }, el("label", { for: "volume", text: t("settings.volume") }), volume, " ", testSound),
		check(t("settings.incoming"), "playIncoming"),
		el("p", { className: "hint", text: t("settings.incomingHint") }),
	),
	section(
		"display-h",
		t("settings.displayHeading"),
		check(t("keyboard.showNames"), "namesOnKeys"),
		check(t("keyboard.showAll"), "showAllKeys"),
		check(t("settings.noteColors"), "noteColors", (on) => document.documentElement.toggleAttribute("data-note-colors", on)),
		el("p", { className: "hint", text: t("settings.noteColorsHint") }),
		el("div", { className: "field" }, el("label", { for: "settings-theme", text: t("theme.label") }), themeSelect),
		el("div", { className: "field" }, el("label", { for: "settings-note-names", text: t("settings.noteNames") }), namesSelect),
		el("p", { className: "hint", id: "note-names-hint", text: t("settings.noteNamesHint") }),
	),
	section("lang-h", t("settings.languageHeading"), el("ul", {}, ...langLinks)),
);

// ---- data -----------------------------------------------------------------------------
const dataStatus = el("div", { role: "status" });
const importInput = el("input", { type: "file", id: "import-json", accept: ".json,application/json" });
const exportBtn = el("button", { type: "button", className: "btn", icon: icons.downloadSimple, text: t("settings.exportJson") });
const deleteLocal = el("button", { type: "button", className: "btn", icon: icons.trash, text: t("settings.deleteLocal") });
const dataBox = section(
	"data-h",
	t("settings.dataHeading"),
	el("p", { text: t("settings.dataIntro") }),
	el("div", { className: "actions" }, exportBtn),
	el("div", { className: "field" }, el("label", { for: "import-json", text: t("settings.importJson") }), importInput),
	dataStatus,
	el("div", { className: "actions" }, deleteLocal),
);
root.append(dataBox);

exportBtn.addEventListener("click", () => {
	const payload = { format: "nuottitreeni-progress", version: 1, exportedAt: new Date().toISOString(), progress: getProgress(), settings: getSettings(), devices: getJson("devices", {}) };
	download(`nuottitreeni-${new Date().toISOString().slice(0, 10)}.json`, `${JSON.stringify(payload, null, 2)}\n`, "application/json");
});

importInput.addEventListener("change", async () => {
	dataStatus.replaceChildren();
	const file = importInput.files?.[0];
	if (!file) return;
	let payload;
	try {
		payload = JSON.parse(await file.text());
	} catch {
		dataStatus.append(el("p", { className: "notice notice-bad", text: t("settings.importFailed", { reason: "JSON" }) }));
		return;
	}
	const progress = payload?.format === "nuottitreeni-progress" ? payload.progress : payload;
	const check = validateProgress(progress, CATALOG_IDS);
	if (!check.ok) {
		dataStatus.append(el("p", { className: "notice notice-bad", text: t("settings.importFailed", { reason: check.errors.slice(0, 2).join("; ") }) }));
		return;
	}
	const agg = aggregate(progress);
	const merge = el("button", { type: "button", className: "btn btn-primary", text: t("settings.importMerge") });
	const replace = el("button", { type: "button", className: "btn", text: t("settings.importReplace") });
	const done = () => dataStatus.replaceChildren(el("p", { className: "notice notice-ok", text: t("settings.importDone") }));
	merge.addEventListener("click", () => {
		saveProgress(pruneDevices(mergeProgress(getProgress(), progress)));
		if (payload.devices) setJson("devices", { ...getJson("devices", {}), ...payload.devices });
		done();
	});
	replace.addEventListener("click", () =>
		confirmStep(dataStatus, t("settings.importReplace"), async () => {
			saveProgress(pruneDevices(progress));
			done();
		}),
	);
	dataStatus.append(el("p", { text: t("settings.importPreview", { lessons: Object.keys(agg.lessons).length, days: Object.keys(agg.practice).length }) }), el("div", { className: "actions" }, merge, replace));
	merge.focus();
});

deleteLocal.addEventListener("click", () =>
	confirmStep(dataStatus, t("settings.confirmDeleteLocal"), async () => {
		sync.unlink();
		await clearAll();
		dataStatus.replaceChildren(el("p", { className: "notice notice-ok", text: t("settings.deletedLocal") }));
	}),
);

// ---- sync -------------------------------------------------------------------------------
const syncBox = section("sync-h", t("settings.syncHeading"));
root.append(syncBox);
const syncStatus = el("p", { role: "status" });
const statusText = {
	syncing: () => t("settings.syncing"),
	synced: () => t("settings.synced"),
	offline: () => t("settings.offline"),
	failed: () => t("settings.syncFailed"),
	"rate-limited": () => t("settings.rateLimited"),
	gone: () => t("settings.notFound"),
	idle: () => "",
};
sync.addEventListener("status", (e) => {
	syncStatus.textContent = statusText[e.detail.state]?.() ?? "";
	if (["synced", "gone", "idle"].includes(e.detail.state)) renderSync();
});

async function syncEnabled() {
	let res;
	try {
		res = await fetch("/api/config", { cache: "no-store" });
	} catch {
		return true; // offline: show the controls; requests will report the offline state
	}
	// A host without the sync API (static hosting, scripts/serve.mjs) answers 404 or HTML.
	if (!res.ok) return false;
	try {
		return (await res.json()).syncEnabled !== false;
	} catch {
		return false;
	}
}

async function renderSync() {
	const parts = [el("p", { text: t("settings.syncIntro") }), el("p", { text: t("settings.syncWarning") })];
	if (!(await syncEnabled())) {
		syncBox.replaceChildren(syncBox.firstChild, el("p", { className: "notice", text: t("settings.syncDisabled") }));
		return;
	}
	const st = sync.state;
	const errors = el("div", { role: "status" });
	const fail = (e) => {
		errors.replaceChildren(
			el("p", {
				className: "notice notice-bad",
				text: e?.code === "BAD_CODE" ? t("settings.badCode") : e?.status === 404 ? t("settings.notFound") : e?.status === 429 ? t("settings.rateLimited") : e?.code === "OFFLINE" ? t("settings.offline") : t("settings.syncFailed"),
			}),
		);
	};
	if (!st.code) {
		const create = el("button", { type: "button", className: "btn btn-primary", icon: icons.key, text: t("settings.createCode") });
		create.addEventListener("click", () => sync.create().then(renderSync, fail));
		const input = el("input", { type: "text", id: "sync-code", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-describedby": "sync-code-hint" });
		const link = el("button", { type: "button", className: "btn", icon: icons.link, text: t("settings.link") });
		link.addEventListener("click", () => sync.link(input.value).then(renderSync, fail));
		parts.push(
			el("div", { className: "actions" }, create),
			el("h3", { text: t("settings.useCode") }),
			el("div", { className: "field" }, el("label", { for: "sync-code", text: t("settings.codeLabel") }), input, el("p", { className: "hint", id: "sync-code-hint", text: t("settings.codeHint") })),
			el("div", { className: "actions" }, link),
		);
	} else {
		const copy = el("button", { type: "button", className: "btn", icon: icons.copy, text: t("settings.copyCode") });
		const copied = el("span", { role: "status" });
		copy.addEventListener("click", () => navigator.clipboard?.writeText(st.code).then(() => (copied.textContent = t("settings.copied")), () => {}));
		const now = el("button", { type: "button", className: "btn btn-primary", icon: icons.arrowsClockwise, text: t("settings.syncNow") });
		now.addEventListener("click", () => sync.syncNow().catch(() => {}));
		const dl = el("button", { type: "button", className: "btn", icon: icons.cloudArrowDown, text: t("settings.downloadServer") });
		dl.addEventListener("click", async () => {
			try {
				const data = await sync.download();
				download(`nuottitreeni-server-${new Date().toISOString().slice(0, 10)}.json`, `${JSON.stringify(data, null, 2)}\n`, "application/json");
			} catch (e) {
				fail(e);
			}
		});
		const unlink = el("button", { type: "button", className: "btn", icon: icons.linkBreak, text: t("settings.unlink") });
		unlink.addEventListener("click", () => sync.unlink());
		const del = el("button", { type: "button", className: "btn", icon: icons.trash, text: t("settings.deleteServer") });
		del.addEventListener("click", () =>
			confirmStep(errors, t("settings.confirmDeleteServer"), async () => {
				try {
					await sync.deleteServer();
					// The section re-renders after unlinking; the persistent status line keeps the message.
					syncStatus.textContent = t("settings.deletedServer");
				} catch (e) {
					fail(e);
				}
			}),
		);
		parts.push(
			el("p", {}, t("settings.yourCode"), ": ", el("span", { className: "code", text: st.code }), " ", copy, " ", copied),
			check(t("settings.autoSync"), "autoSync"),
			el("p", { text: st.lastSyncAt ? t("settings.lastSync", { time: f.dateTime(st.lastSyncAt) }) : t("settings.neverSynced") }),
			el("div", { className: "actions" }, now, dl, unlink, del),
		);
	}
	parts.push(syncStatus, errors);
	syncBox.replaceChildren(syncBox.firstChild, ...parts);
}
renderSync();

// ---- offline ------------------------------------------------------------------------------
const offlineStatus = el("p", { role: "status" });
const offlineBtn = el("button", { type: "button", className: "btn", icon: icons.downloadSimple, text: t("settings.offlineSaveNow") });
root.append(section("offline-h", t("settings.offlineHeading"), el("p", { text: t("settings.offlineIntro") }), offlineStatus, el("div", { className: "actions" }, offlineBtn)));

async function askWorker(type) {
	const reg = await navigator.serviceWorker?.ready;
	if (!reg?.active) return null;
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = (e) => resolve(e.data);
		reg.active.postMessage({ type }, [channel.port2]);
		setTimeout(() => resolve(null), 30000);
	});
}
async function renderOffline(type = "status") {
	if (!("serviceWorker" in navigator)) {
		offlineStatus.textContent = t("settings.offlineUnsupported");
		offlineBtn.hidden = true;
		return;
	}
	const s = await askWorker(type);
	if (!s) return;
	offlineStatus.textContent = s.done >= s.total ? t("settings.offlineAll") : t("settings.offlineStatus", { done: s.done, total: s.total });
	offlineBtn.hidden = s.done >= s.total;
}
offlineBtn.addEventListener("click", () => renderOffline("cache-heavy"));
renderOffline();
