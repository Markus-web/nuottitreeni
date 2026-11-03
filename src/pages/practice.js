// Drill for pitch lessons: /harjoitus/?l=<lesson id>&m=single|row|ear
// Only the first try of each note counts; a miss explains the note and waits for the right key.
import { KEY_SIGS, PITCH_LESSONS, ROUND_SIZE, ROW_LENGTH, UNLOCK_PCT } from "../content/catalog.js";
import { explainParts } from "../core/explain.js";
import { PianoKeyboard } from "../core/keyboard.js";
import { octaveRange } from "../core/keyboard-layout.js";
import { midiOf, noteKey, noteName, pitchClass, spellMidi } from "../core/notes.js";
import { aggregate, recordRound } from "../core/progress.js";
import { renderStaff } from "../core/staff.js";
import { getDeviceId, getProgress, getSettings, saveProgress, saveSettings } from "../core/store.js";
import * as icons from "../content/icons.js";
import { $, boot, el, focusHeading, setLabel } from "./common.js";

const ctx = await boot();
const { t, f, hub, sound, dict, noteNames } = ctx;
const root = $("#app-root");
const params = new URLSearchParams(location.search);
const lesson = PITCH_LESSONS.find((l) => l.id === params.get("l"));
const mode = lesson?.modes.includes(params.get("m")) ? params.get("m") : "single";
const heading = $("#page-title");

if (!lesson) {
	root.append(el("p", { className: "notice", text: t("drill.noLesson") }), el("p", {}, el("a", { className: "standalone", href: ctx.paths.home, text: t("common.home") })));
} else start();

function nameOf(n) {
	return noteName(n.step, n.alter, noteNames);
}

function explainText(target) {
	return explainParts(target)
		.map((p) => t(p.key, { ...p.vars, name: p.vars.step ? noteName(p.vars.step, p.vars.alter ?? 0, noteNames) : "" }))
		.join(" ");
}

function start() {
	const tx = dict.lessons[lesson.id];
	const title = `${tx.title} (${t(`modes.${mode}.label`).toLowerCase()})`;
	heading.textContent = title;
	document.title = `${title}, ${t("site.name")}`;
	const progress = aggregate(getProgress());
	const idx = PITCH_LESSONS.indexOf(lesson);
	const prev = PITCH_LESSONS[idx - 1];
	const next = PITCH_LESSONS[idx + 1];

	const back = el("p", {}, el("a", { className: "standalone", href: ctx.paths.lesson[lesson.id], text: `${t("drill.backToGuide")}: ${tx.title}` }));
	const notice = prev && (progress.lessons[prev.id]?.single?.best ?? 0) < UNLOCK_PCT ? el("p", { className: "notice", text: t("guide.notYet", { title: dict.lessons[prev.id].title }) }) : null;
	const hint = el("p", {}, el("strong", { text: t("guide.remember") }), " ", tx.hint);
	const count = el("p", { className: "count" });
	const keySigLine = el("p", { className: "muted" });
	const prompt = el("p", { className: "prompt", "aria-live": "polite" });
	const figure = el("div", { className: "staff-box" });
	const letter = el("p", { className: "name-target", hidden: true });
	const listen = el("button", { type: "button", className: "btn", icon: icons.speakerHigh, text: t("drill.listen") });
	const feedback = el("div", { className: "feedback", "aria-live": "polite" });
	const question = el("section", { className: "question", "aria-label": t("drill.promptStaff") }, prompt, keySigLine, figure, letter, el("div", { className: "actions" }, listen), feedback);
	const kbdBox = el("div");
	const options = el(
		"div",
		{ className: "kbd-options" },
		checkbox(t("keyboard.showNames"), getSettings().namesOnKeys, (v) => {
			saveSettings({ namesOnKeys: v });
			keyboard.setNames(v);
		}),
		checkbox(t("keyboard.showAll"), getSettings().showAllKeys, (v) => {
			saveSettings({ showAllKeys: v });
			setRange();
		}),
	);
	const summary = el("section", { hidden: true, "aria-labelledby": "summary-h" });
	root.append(...[back, notice, hint, el("div", { className: "drill-head" }, count), question, kbdBox, options, summary].filter(Boolean));

	const keyboard = new PianoKeyboard(kbdBox, { t, noteNames, low: 48, high: 83, names: getSettings().namesOnKeys, id: "drill-kbd" });
	function setRange() {
		if (getSettings().showAllKeys) keyboard.setRange(21, 108);
		else {
			const r = octaveRange(...lesson.range);
			keyboard.setRange(r.low, r.high);
		}
	}
	setRange();
	keyboard.addEventListener("key", (e) => hub.screen(e.detail.midi, e.detail.on));
	hub.addEventListener("note", (e) => {
		keyboard.setOn(e.detail.midi, e.detail.on);
		if (e.detail.on) onNote(e.detail.midi);
	});

	// ---- round state --------------------------------------------------------------
	let round = null;

	function weightOf(n) {
		const s = aggregate(getProgress()).lessons[lesson.id]?.[mode]?.notes?.[n.key];
		if (!s) return 2;
		return 1 + 4 * (s.w / Math.max(1, s.a)) + Math.min(2, Math.max(0, ((s.medianMs ?? 1500) - 1500) / 1500));
	}

	function pick(pool, avoid) {
		const c = pool.filter((n) => n.key !== avoid);
		const w = c.map(weightOf);
		let r = Math.random() * w.reduce((a, b) => a + b, 0);
		for (let i = 0; i < c.length; i++) if ((r -= w[i]) <= 0) return c[i];
		return c[c.length - 1];
	}

	function newRound() {
		const keySig = lesson.keySigs ? lesson.keySigs[Math.floor(Math.random() * lesson.keySigs.length)] : null;
		const pool = lesson.pool(keySig).map((n) => ({ ...n, midi: n.octave == null ? null : midiOf(n), key: noteKey(n.step, n.alter, n.octave) }));
		const total = mode === "row" ? ROW_LENGTH * 3 : ROUND_SIZE;
		round = { keySig, pool, total, i: 0, results: [], missed: false, busy: false, row: [], rowPos: 0, target: null, shownAt: 0, prevKey: null, earStarted: mode !== "ear" };
		keySigLine.textContent = keySig ? t("drill.keySig", { name: dict.keySigNames[keySig] }) : "";
		summary.hidden = true;
		question.hidden = false;
		listen.hidden = false;
		if (mode === "ear") {
			// Browsers allow sound only after a click, so the first note waits for this button.
			prompt.textContent = t("drill.promptEar");
			figure.replaceChildren();
			letter.hidden = true;
			setLabel(listen, icons.speakerHigh, t("common.start"));
			count.textContent = t("drill.count", { i: 1, n: round.total });
			return;
		}
		nextQuestion();
	}

	function nextRow() {
		const row = [];
		let prevKey = round.prevKey;
		for (let i = 0; i < ROW_LENGTH; i++) {
			const n = pick(round.pool, prevKey);
			row.push(n);
			prevKey = n.key;
		}
		round.row = row;
		round.rowPos = 0;
		round.prevKey = prevKey;
	}

	function nextQuestion() {
		keyboard.clearMarks();
		feedback.replaceChildren();
		if (round.i >= round.total) return finish();
		round.missed = false;
		round.busy = false;
		if (mode === "row") {
			if (!round.row.length || round.rowPos >= round.row.length) nextRow();
			round.target = round.row[round.rowPos];
		} else {
			round.target = pick(round.pool, round.prevKey);
			round.prevKey = round.target.key;
		}
		round.shownAt = performance.now();
		count.textContent = t("drill.count", { i: round.i + 1, n: round.total });
		question.dataset.key = round.target.key;
		draw();
		if (mode === "ear") playTarget();
	}

	function staffLabel() {
		const base = lesson.staff === "bass" ? t("drill.staffBass") : lesson.staff === "grand" ? t("drill.staffGrand") : t("drill.staffTreble");
		return round.keySig ? `${base}. ${t("drill.keySig", { name: dict.keySigNames[round.keySig] })}` : base;
	}

	function draw(state = "") {
		const target = round.target;
		setLabel(listen, icons.speakerHigh, mode === "ear" ? t("drill.listenAgain") : t("drill.listen"));
		if (mode === "ear") {
			prompt.textContent = t("drill.promptEar");
			letter.hidden = true;
			figure.replaceChildren();
			if (state === "bad" && lesson.staff) figure.innerHTML = renderStaff({ staff: lesson.staff, keySig: round.keySig ? KEY_SIGS[round.keySig].alters : null, items: [{ type: "note", value: "q", notes: [target], state: "bad" }], label: staffLabel() });
			return;
		}
		if (!lesson.staff) {
			figure.replaceChildren();
			letter.hidden = false;
			letter.textContent = nameOf(target);
			letter.className = `name-target${state ? ` is-${state}` : ""}`;
			prompt.textContent = t("drill.promptKeys", { name: nameOf(target) });
			return;
		}
		letter.hidden = true;
		const keySig = round.keySig ? KEY_SIGS[round.keySig].alters : null;
		if (mode === "row") {
			prompt.textContent = t("drill.promptRow");
			const items = round.row.map((n, i) => ({
				type: "note",
				value: "q",
				notes: [n],
				midi: i === round.rowPos ? n.midi : undefined,
				state: i < round.rowPos ? "done" : i === round.rowPos ? (state === "bad" ? "bad" : "current") : "",
			}));
			figure.innerHTML = renderStaff({ staff: lesson.staff, keySig, items, label: t("drill.rowLabel", { n: round.row.length }), className: "staff-row" });
		} else {
			prompt.textContent = t("drill.promptStaff");
			figure.innerHTML = renderStaff({ staff: lesson.staff, keySig, items: [{ type: "note", value: "q", notes: [target], state, midi: target.midi }], label: staffLabel() });
		}
	}

	function playTarget() {
		const m = round.target.midi ?? midiOf({ ...round.target, octave: 4 });
		sound.play(m, 90);
		hub.sendNote(m, true);
		setTimeout(() => {
			sound.stop(m);
			hub.sendNote(m, false);
		}, 900);
	}

	listen.addEventListener("click", () => {
		if (!round) return;
		if (!round.earStarted) {
			round.earStarted = true;
			nextQuestion();
			return;
		}
		if (round.target) playTarget();
	});

	function matches(target, midi) {
		return target.midi == null ? pitchClass(midi) === pitchClass(midiOf({ ...target, octave: 4 })) : midi === target.midi;
	}

	function onNote(midi) {
		if (!round || round.busy || !round.target || !round.earStarted || !summary.hidden) return;
		const target = round.target;
		const ms = Math.round(performance.now() - round.shownAt);
		if (matches(target, midi)) {
			if (!round.missed) round.results.push({ key: target.key, ok: true, ms });
			round.busy = true;
			round.i++;
			feedback.replaceChildren(el("p", { className: "ok", text: t("drill.correct") }));
			if (mode === "row") {
				round.rowPos++;
				setTimeout(nextQuestion, 150);
			} else {
				draw("ok");
				setTimeout(nextQuestion, round.missed ? 700 : 450);
			}
			return;
		}
		keyboard.clearMarks();
		keyboard.mark(midi, "wrong");
		if (target.midi == null) {
			for (let m = keyboard.low; m <= keyboard.high; m++) if (matches(target, m)) keyboard.mark(m, "target");
		} else keyboard.mark(target.midi, "target");
		if (round.missed) return;
		round.missed = true;
		round.results.push({ key: target.key, ok: false, ms });
		draw("bad");
		const spelled = spellMidi(midi);
		const played = noteName(spelled.step, spelled.alter, noteNames);
		feedback.replaceChildren(
			el("p", {}, el("span", { className: "bad", text: t("drill.wrong", { name: nameOf(target) }) }), " ", t("drill.youPlayed", { name: played })),
			el("p", { text: explainText(target) }),
			el("p", { text: t("drill.playCorrect") }),
		);
	}

	function finish() {
		const res = round.results;
		const accuracy = Math.round((100 * res.filter((r) => r.ok).length) / Math.max(1, res.length));
		const times = res.map((r) => r.ms).sort((a, b) => a - b);
		const median = times.length ? times[times.length >> 1] : 0;
		const before = aggregate(getProgress()).lessons[lesson.id]?.single?.best ?? 0;
		saveProgress(recordRound(getProgress(), getDeviceId(), { kind: "lesson", id: lesson.id, mode, accuracy, results: res }, Date.now()));
		const weak = [...new Map(res.filter((r) => !r.ok).map((r) => [r.key, r])).values()]
			.map((r) => round.pool.find((p) => p.key === r.key))
			.filter(Boolean)
			.slice(0, 5)
			.map(nameOf);
		question.hidden = true;
		const h = el("h2", { id: "summary-h", text: t("drill.summary") });
		const message =
			accuracy >= UNLOCK_PCT ? (mode === "single" && before < UNLOCK_PCT && next ? t("drill.passed", { pct: f.percent(accuracy) }) : "") : t("drill.keepGoing", { pct: f.percent(UNLOCK_PCT) });
		const again = el("button", { type: "button", className: "btn btn-primary", icon: icons.arrowCounterClockwise, text: t("drill.again") });
		again.addEventListener("click", () => {
			newRound();
			focusHeading(heading);
		});
		summary.replaceChildren(
			h,
			el(
				"dl",
				{ className: "facts" },
				el("div", {}, el("dt", { text: t("drill.accuracy") }), el("dd", { text: f.percent(accuracy) })),
				el("div", {}, el("dt", { text: t("drill.typical") }), el("dd", { text: t("drill.seconds", { s: f.seconds(median) }) })),
			),
			message ? el("p", { text: message }) : null,
			el("h3", { text: t("drill.weakest") }),
			el("p", { text: weak.length ? weak.join(", ") : t("drill.none") }),
			el(
				"div",
				{ className: "actions" },
				again,
				el("a", { className: "btn", href: ctx.paths.lesson[lesson.id], icon: icons.arrowLeft, text: t("drill.backToGuide") }),
				next && accuracy >= UNLOCK_PCT ? el("a", { className: "btn", href: ctx.paths.lesson[next.id], icon: icons.arrowRight, text: `${t("guide.nextLesson")}: ${dict.lessons[next.id].title}` }) : null,
			),
		);
		summary.hidden = false;
		focusHeading(h, `${t("drill.summary")}, ${t("site.name")}`);
	}

	newRound();
}

function checkbox(label, checked, onChange) {
	const input = el("input", { type: "checkbox" });
	input.checked = checked;
	input.addEventListener("change", () => onChange(input.checked));
	return el("label", { className: "check" }, input, label);
}
