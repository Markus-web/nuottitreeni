// Lesson guide: shows a gentle notice when the previous lesson is not passed yet.
import { UNLOCK_PCT } from "../content/catalog.js";
import { aggregate } from "../core/progress.js";
import { getProgress } from "../core/store.js";
import { boot } from "./common.js";

const ctx = await boot();
const data = ctx.cfg.data || {};
if (data.lesson && data.previous) {
	const best = aggregate(getProgress()).lessons[data.previous]?.single?.best ?? 0;
	const notice = document.getElementById("not-yet");
	if (notice && best < UNLOCK_PCT) {
		notice.textContent = ctx.t("guide.notYet", { title: ctx.dict.lessons[data.previous].title });
		notice.hidden = false;
	}
}
