// Status lines on piece cards (pieces page and home page): how often a built-in piece was
// played and the fewest wrong notes in a run, from this browser's progress (recordPiece).
import { aggregate } from "../core/progress.js";
import { getProgress } from "../core/store.js";

export function renderPieceStatuses(ctx) {
	const { t } = ctx;
	const pieces = aggregate(getProgress()).pieces;
	for (const node of document.querySelectorAll("[data-piece] [data-status]")) {
		const s = pieces[node.closest("[data-piece]").dataset.piece];
		node.dataset.done = String(s?.runs > 0 && s.best === 0);
		node.textContent = !s?.runs ? "" : s.best === 0 ? t("pieces.statusClean", { runs: s.runs }) : t("pieces.statusPlayed", { runs: s.runs, wrong: s.best });
	}
}
