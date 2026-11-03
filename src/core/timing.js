// Timing judgment shared by rhythm tap and the tempo mode of pieces, and the 0-100 score of a
// piece run. Pure, so the tests can check every rule.

/**
 * Match played notes to expected notes in time.
 * expected: [{ at: ms, midi? }] in order; hits: [{ at: ms, midi? }]. When both have a midi, only
 * the same key matches. Each expected note takes the nearest unused hit within `reach` ms:
 * within `window` ms it is on time, otherwise early or late; without a hit it is missed.
 * Returns { results: ["onTime" | "early" | "late" | "missed"], counts, wrong, longestStreak }:
 * `wrong` counts hits that matched nothing, `longestStreak` the most on-time notes in a row.
 */
export function judgeTiming(expected, hits, { window, reach }) {
	const used = new Set();
	const counts = { onTime: 0, early: 0, late: 0, missed: 0 };
	let streak = 0;
	let longestStreak = 0;
	const results = expected.map((e) => {
		let best = -1;
		for (let j = 0; j < hits.length; j++) {
			if (used.has(j)) continue;
			if (e.midi != null && hits[j].midi != null && hits[j].midi !== e.midi) continue;
			if (best < 0 || Math.abs(hits[j].at - e.at) < Math.abs(hits[best].at - e.at)) best = j;
		}
		const diff = best >= 0 ? hits[best].at - e.at : null;
		let result = "missed";
		if (diff != null && Math.abs(diff) <= reach) {
			used.add(best);
			result = Math.abs(diff) <= window ? "onTime" : diff < 0 ? "early" : "late";
		}
		counts[result]++;
		streak = result === "onTime" ? streak + 1 : 0;
		longestStreak = Math.max(longestStreak, streak);
		return result;
	});
	return { results, counts, wrong: hits.length - used.size, longestStreak };
}

/**
 * Score of a piece run, 0 to 100.
 * Wait mode: every note is played in the end, so the score is the share of right presses:
 *   100 x notes / (notes + wrong).
 * Tempo mode: on time counts 1, early or late 1/2, missed 0, and each wrong note takes 1/2
 * away; the total is divided by the number of notes and kept between 0 and 100.
 */
export function pieceScore({ mode, notes, wrong = 0, counts = null }) {
	if (!notes) return 0;
	if (mode !== "tempo") return Math.round((100 * notes) / (notes + wrong));
	const points = counts.onTime + 0.5 * (counts.early + counts.late) - 0.5 * wrong;
	return Math.max(0, Math.min(100, Math.round((100 * points) / notes)));
}
