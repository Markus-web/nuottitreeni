// Practice log: minutes per day, daily goal, and the MIDI takes recorded in this browser.
// Takes can be played, downloaded one by one or all as a ZIP, deleted (with confirmation),
// and MIDI files can be imported as takes. Minutes export as CSV.
import { aggregate, localDay, practiceSummary } from "../core/progress.js";
import { parseSmf, tickToMs } from "../core/smf.js";
import { getProgress, getSettings, idb, saveSettings } from "../core/store.js";
import { zipStore } from "../core/zip.js";
import * as icons from "../content/icons.js";
import { $, boot, download, el, setLabel } from "./common.js";

const ctx = await boot();
const { t, f, sound } = ctx;
const root = $("#app-root");
const summary = el("p", {});
const goalSelect = el("select", { id: "goal" });
for (const m of [0, 5, 10, 15, 20, 30, 45, 60]) goalSelect.append(el("option", { value: String(m), text: m ? t("log.goalMinutes", { n: m }) : t("log.goalNone") }));
goalSelect.value = String(getSettings().dailyGoalMin);
goalSelect.addEventListener("change", () => {
	saveSettings({ dailyGoalMin: Number(goalSelect.value) });
	renderSummary();
});
const goalLine = el("p", { role: "status" });
const table = el("div", { className: "table-wrap", tabindex: "0", role: "region", "aria-label": t("log.tableCaption") });
const autoRec = el("input", { type: "checkbox" });
autoRec.checked = getSettings().autoRecord;
autoRec.addEventListener("change", () => saveSettings({ autoRecord: autoRec.checked }));
const idle = el("select", { id: "idle" });
for (const s of [30, 60, 90, 120, 180, 300]) idle.append(el("option", { value: String(s), text: t("log.idleSeconds", { n: s }) }));
idle.value = String(getSettings().idleSec);
idle.addEventListener("change", () => saveSettings({ idleSec: Number(idle.value) }));
const takesList = el("ul", { className: "results" });
const takesStatus = el("div", { role: "status" });
const importInput = el("input", { type: "file", id: "import-take", accept: ".mid,.midi,audio/midi" });
const zipBtn = el("button", { type: "button", className: "btn", icon: icons.downloadSimple, text: t("log.downloadAll") });
const csvBtn = el("button", { type: "button", className: "btn", icon: icons.downloadSimple, text: t("log.downloadCsv") });

root.append(
	summary,
	el("div", { className: "field" }, el("label", { for: "goal", text: t("log.goal") }), goalSelect),
	goalLine,
	table,
	el("h2", { text: t("log.recordings") }),
	el("label", { className: "check" }, autoRec, t("log.autoRecord")),
	el("div", { className: "field" }, el("label", { for: "idle", text: t("log.idle") }), idle),
	takesStatus,
	takesList,
	el("div", { className: "actions" }, zipBtn, csvBtn),
	el("div", { className: "field" }, el("label", { for: "import-take", text: t("log.importMidi") }), importInput),
);

function renderSummary() {
	const agg = aggregate(getProgress());
	const p = practiceSummary(agg.practice, Date.now());
	summary.textContent = t("log.summary", { today: f.minutes(p.todaySec), week: f.minutes(p.weekSec), streak: p.streak });
	const goal = getSettings().dailyGoalMin;
	goalLine.textContent = goal && p.todaySec >= goal * 60 ? t("log.goalReached") : "";
	const rows = [];
	for (let i = 0; i < 14; i++) {
		const day = localDay(Date.now() - i * 86400000);
		rows.push(el("tr", {}, el("th", { scope: "row", text: f.date(new Date(`${day}T12:00:00`)) }), el("td", { className: "num", text: f.minutes(agg.practice[day] ?? 0) })));
	}
	table.replaceChildren(
		el(
			"table",
			{},
			el("caption", { text: t("log.tableCaption") }),
			el("thead", {}, el("tr", {}, el("th", { scope: "col", text: t("log.day") }), el("th", { scope: "col", className: "num", text: t("log.minutes") }))),
			el("tbody", {}, ...rows),
		),
	);
}

let stopPlayback = null;

function play(take, button) {
	if (stopPlayback) {
		stopPlayback();
		stopPlayback = null;
		setLabel(button, icons.play, t("log.play"));
		return;
	}
	const parsed = parseSmf(take.smf);
	const notes = parsed.tracks.flatMap((tr) => tr.notes.map((n) => ({ midi: n.midi, vel: n.vel, at: tickToMs(n.tick, parsed.ppq, parsed.tempos) / 1000, dur: Math.max(0.1, (tickToMs(n.tick + n.dur, parsed.ppq, parsed.tempos) - tickToMs(n.tick, parsed.ppq, parsed.tempos)) / 1000) })));
	sound.unlock();
	stopPlayback = sound.sequence(notes);
	setLabel(button, icons.stop, t("log.stop"));
	const end = Math.max(0, ...notes.map((n) => n.at + n.dur));
	setTimeout(() => {
		stopPlayback = null;
		setLabel(button, icons.play, t("log.play"));
	}, end * 1000 + 300);
}

function takeLabel(take) {
	const mins = Math.floor(take.seconds / 60);
	const secs = take.seconds % 60;
	return t("log.take", { date: f.dateTime(take.startedAt), duration: `${mins}:${String(secs).padStart(2, "0")}`, notes: take.notes });
}

async function renderTakes() {
	let takes = [];
	try {
		takes = await idb.all("takes");
	} catch {
		takes = [];
	}
	takes.sort((a, b) => b.startedAt - a.startedAt);
	zipBtn.disabled = takes.length === 0;
	if (!takes.length) {
		takesList.replaceChildren(el("li", { text: t("log.empty") }));
		return;
	}
	takesList.replaceChildren(
		...takes.map((take) => {
			const li = el("li", {}, el("span", { text: takeLabel(take) }));
			const playBtn = el("button", { type: "button", className: "btn", icon: icons.play, text: t("log.play") });
			playBtn.addEventListener("click", () => play(take, playBtn));
			const dl = el("button", { type: "button", className: "btn", icon: icons.downloadSimple, text: t("log.download") });
			dl.addEventListener("click", () => download(`nuottitreeni-${localDay(take.startedAt)}-${take.id}.mid`, take.smf, "audio/midi"));
			const del = el("button", { type: "button", className: "btn", icon: icons.trash, text: t("log.remove") });
			del.addEventListener("click", () => {
				const yes = el("button", { type: "button", className: "btn", icon: icons.trash, text: t("common.delete") });
				const no = el("button", { type: "button", className: "btn", text: t("common.cancel") });
				const box = el("div", { className: "actions" }, el("p", { role: "alert", text: t("log.confirmRemove", { date: f.dateTime(take.startedAt) }) }), yes, no);
				li.append(box);
				no.focus();
				no.addEventListener("click", () => box.remove());
				yes.addEventListener("click", async () => {
					await idb.delete("takes", take.id).catch(() => {});
					renderTakes();
				});
			});
			li.append(el("div", { className: "actions" }, playBtn, dl, del));
			return li;
		}),
	);
}

zipBtn.addEventListener("click", async () => {
	const takes = await idb.all("takes").catch(() => []);
	const files = takes.map((tk) => ({ name: `nuottitreeni-${localDay(tk.startedAt)}-${tk.id}.mid`, data: new Uint8Array(tk.smf), date: new Date(tk.startedAt) }));
	download(`nuottitreeni-${localDay(Date.now())}.zip`, zipStore(files), "application/zip");
});
csvBtn.addEventListener("click", () => {
	const practice = aggregate(getProgress()).practice;
	const lines = ["date,minutes", ...Object.keys(practice).sort().map((d) => `${d},${Math.round(practice[d] / 60)}`)];
	download(`nuottitreeni-practice-${localDay(Date.now())}.csv`, `${lines.join("\n")}\n`, "text/csv");
});
importInput.addEventListener("change", async () => {
	const file = importInput.files?.[0];
	if (!file) return;
	try {
		const buf = new Uint8Array(await file.arrayBuffer());
		const parsed = parseSmf(buf);
		const notes = parsed.tracks.reduce((a, tr) => a + tr.notes.length, 0);
		const last = Math.max(0, ...parsed.tracks.flatMap((tr) => tr.notes.map((n) => tickToMs(n.tick + n.dur, parsed.ppq, parsed.tempos))));
		const now = Date.now();
		await idb.put("takes", { id: String(now), startedAt: file.lastModified || now, seconds: Math.round(last / 1000), notes, piece: null, smf: buf });
		renderTakes();
	} catch {
		takesStatus.replaceChildren(el("p", { className: "notice notice-bad", text: t("pieces.importFailed") }));
	}
});
ctx.recorder.addEventListener("saved", renderTakes);
ctx.recorder.addEventListener("capped", () => takesStatus.replaceChildren(el("p", { text: t("log.capped", { n: 200 }) })));
addEventListener("nt-progress", renderSummary);
renderSummary();
renderTakes();
