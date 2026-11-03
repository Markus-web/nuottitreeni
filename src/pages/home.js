// Home: fills lesson statuses and the practice summary from this browser's progress.
import { PITCH_LESSONS, RHYTHM_LESSONS, UNLOCK_PCT } from "../content/catalog.js";
import { aggregate, practiceSummary } from "../core/progress.js";
import { getProgress } from "../core/store.js";
import { boot } from "./common.js";
import { renderPieceStatuses } from "./piece-status.js";

const ctx = await boot();
const { t, f } = ctx;

function render() {
	const agg = aggregate(getProgress());
	// Only the next lesson to do gets a hint; later untouched lessons stay quiet.
	let suggested = false;
	for (const lesson of PITCH_LESSONS) {
		const node = document.querySelector(`[data-lesson="${lesson.id}"] [data-status]`);
		const best = agg.lessons[lesson.id]?.single?.best;
		if (!node) continue;
		node.dataset.done = String(best >= UNLOCK_PCT);
		if (best != null) node.textContent = best >= UNLOCK_PCT ? t("home.statusDone", { pct: f.percent(best) }) : t("home.statusBest", { pct: f.percent(best) });
		else if (!suggested) node.textContent = t("home.statusStart");
		else node.textContent = "";
		if (best == null || best < UNLOCK_PCT) suggested = true;
	}
	for (const r of RHYTHM_LESSONS) {
		const node = document.querySelector(`[data-rhythm="${r.id}"] [data-status]`);
		const best = agg.rhythm[r.id]?.[r.modes[0]]?.best;
		if (node && best != null) {
			node.dataset.done = String(best >= UNLOCK_PCT);
			node.textContent = t("home.statusBest", { pct: f.percent(best) });
		}
	}
	const p = practiceSummary(agg.practice, Date.now());
	const summary = document.getElementById("practice-summary");
	if (summary && (p.weekSec > 0 || Object.keys(agg.lessons).length))
		summary.textContent = t("home.practiceLine", { today: f.minutes(p.todaySec), week: f.minutes(p.weekSec), streak: p.streak });
	renderPieceStatuses(ctx);
}

render();
addEventListener("nt-progress", render);
