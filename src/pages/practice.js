// Drill for pitch lessons (/harjoitus/?l=<lesson id>&m=single|row|ear|name) and free practice
// (/vapaa-harjoitus/: the user picks clef, range, key signature and accidentals).
// Only the first try of each note counts; a miss (or a hint) explains the note and waits for
// the right answer. Answers come from any input (MIDI, microphone, keys) or, in name mode,
// from the note-name buttons.
import { FREE_ID, KEY_SIGS, PITCH_LESSONS, ROUND_SIZE, ROW_LENGTH, UNLOCK_PCT, freeConfig, freeLesson, freeRangeKeys, phraseLesson } from "../content/catalog.js";
import { BEATS } from "../core/notation.js";
import { PHRASE_LEVELS, generatePhrase } from "../core/phrases.js";
import { keepAwake } from "../core/wake-lock.js";
import { explainText as explain, workedExample } from "../core/worked-example.js";
import { PianoKeyboard } from "../core/keyboard.js";
import { octaveRange } from "../core/keyboard-layout.js";
import { midiLabel, midiOf, noteKey, noteName, parseNoteKey, pitchClass, spellMidi } from "../core/notes.js";
import { aggregate, recordRound } from "../core/progress.js";
import { renderStaff } from "../core/staff.js";
import { getDeviceId, getProgress, getSettings, saveProgress, saveSettings } from "../core/store.js";
import * as icons from "../content/icons.js";
import { $, boot, el, focusHeading, howTo, setLabel } from "./common.js";
import { fullscreenButton } from "./fullscreen.js";

const PHRASES_PER_ROUND = 5;

const ctx = await boot();
const { t, f, hub, sound, dict, noteNames } = ctx;
const root = $("#app-root");
const params = new URLSearchParams(location.search);
const heading = $("#page-title");
const isFree = ctx.cfg.page === "freePractice";
const isPhrases = ctx.cfg.page === "phrases";

function nameOf(n) {
	return noteName(n.step, n.alter, noteNames);
}

function explainText(target) {
	return explain(target, t, noteNames);
}

if (isFree) setupFree();
else if (isPhrases) setupPhrases();
else {
	const lesson = PITCH_LESSONS.find((l) => l.id === params.get("l"));
	if (!lesson) root.append(el("p", { className: "notice", text: t("drill.noLesson") }), el("p", {}, el("a", { className: "standalone", href: ctx.paths.home, text: t("common.home") })));
	else start(lesson, lesson.modes.includes(params.get("m")) ? params.get("m") : "single", root);
}

// ---- free practice: settings form, then the same drill ------------------------------------
function setupFree() {
	const fromUrl = params.has("c")
		? { clef: params.get("c"), low: params.get("lo"), high: params.get("hi"), fifths: Number(params.get("k")), accidentals: params.get("a") === "1", mode: params.get("m") }
		: (getSettings().freePractice ?? {});
	let config = freeConfig(fromUrl);
	const select = (id, options, value) => {
		const s = el("select", { id });
		for (const [v, label] of options) s.append(el("option", { value: String(v), text: label }));
		s.value = String(value);
		return s;
	};
	const clefSel = select("free-clef", ["treble", "bass", "grand"].map((c) => [c, t(`free.clef.${c}`)]), config.clef);
	const lowSel = el("select", { id: "free-low" });
	const highSel = el("select", { id: "free-high" });
	const fillRange = (low, high) => {
		const keys = freeRangeKeys(clefSel.value);
		for (const s of [lowSel, highSel]) s.replaceChildren(...keys.map((k) => el("option", { value: k, text: midiLabel(midiOf(parseNoteKey(k)), noteNames) })));
		lowSel.value = keys.includes(low) ? low : keys[0];
		highSel.value = keys.includes(high) ? high : keys[keys.length - 1];
	};
	fillRange(config.low, config.high);
	clefSel.addEventListener("change", () => {
		const d = freeConfig({ clef: clefSel.value });
		fillRange(d.low, d.high);
	});
	const sigNames = { 0: t("free.noKeySig") };
	for (const [name, sig] of Object.entries(KEY_SIGS)) sigNames[sig.fifths] = dict.keySigNames[name];
	const keySel = select("free-key", [0, 1, 2, 3, -1, -2, -3].map((v) => [v, sigNames[v]]), config.fifths);
	const acc = el("input", { type: "checkbox", id: "free-acc" });
	acc.checked = config.accidentals;
	const modeSel = select("free-mode", ["single", "row", "ear", "name"].map((m) => [m, t(`modes.${m}.label`)]), config.mode);
	const startBtn = el("button", { type: "button", className: "btn btn-primary", icon: icons.play, text: t("free.start") });
	const status = el("p", { role: "status" });
	const field = (id, label, control) => el("div", { className: "field" }, el("label", { for: id, text: label }), control);
	const form = el(
		"section",
		{ "aria-labelledby": "free-settings-h", className: "free-form" },
		el("h2", { id: "free-settings-h", text: t("free.settings") }),
		field("free-clef", t("free.clefLabel"), clefSel),
		field("free-low", t("free.low"), lowSel),
		field("free-high", t("free.high"), highSel),
		field("free-key", t("free.keySig"), keySel),
		el("label", { className: "check" }, acc, t("free.accidentals")),
		field("free-mode", t("free.mode"), modeSel),
		el("div", { className: "actions" }, startBtn),
		status,
	);
	const drillBox = el("div", { id: "free-drill" });
	root.append(howTo(ctx, "free", dict.howto.free), form, drillBox);
	startBtn.addEventListener("click", () => {
		config = freeConfig({ clef: clefSel.value, low: lowSel.value, high: highSel.value, fifths: Number(keySel.value), accidentals: acc.checked, mode: modeSel.value });
		if (lowSel.value !== config.low || highSel.value !== config.high) {
			fillRange(config.low, config.high);
			status.textContent = t("free.rangeFixed");
		} else status.textContent = "";
		saveSettings({ freePractice: config });
		const q = new URLSearchParams({ c: config.clef, lo: config.low, hi: config.high, k: String(config.fifths), a: config.accidentals ? "1" : "0", m: config.mode });
		history.replaceState(null, "", `${location.pathname}?${q}`);
		start(freeLesson(config), config.mode, drillBox);
		focusHeading(drillBox.querySelector("h2"));
	});
	if (params.has("c")) start(freeLesson(config), config.mode, drillBox);
}

// ---- phrase training: choose a level (and a clef on level 3), then the drill in row mode ---------
function setupPhrases() {
	const saved = params.has("level") ? { level: Number(params.get("level")), clef: params.get("c") } : (getSettings().phrases ?? { level: 1, clef: "treble" });
	const levels = el("fieldset", {}, el("legend", { text: t("phrases.levelLegend") }));
	for (const level of [1, 2, 3, 4]) {
		const input = el("input", { type: "radio", name: "phrase-level", value: String(level) });
		input.checked = level === (PHRASE_LEVELS[saved.level] ? saved.level : 1);
		levels.append(el("label", { className: "check" }, input, `${t("phrases.levelTitle", { n: level })}: ${t(`phrases.levels.${level}`)}`));
	}
	const clefSel = el("select", { id: "phrase-clef" });
	for (const c of ["treble", "bass"]) clefSel.append(el("option", { value: c, text: t(`free.clef.${c}`) }));
	clefSel.value = saved.clef === "bass" ? "bass" : "treble";
	const clefField = el("div", { className: "field" }, el("label", { for: "phrase-clef", text: t("phrases.clefLabel") }), clefSel);
	const levelNow = () => Number(root.querySelector('input[name="phrase-level"]:checked')?.value ?? 1);
	const syncClef = () => (clefField.hidden = levelNow() !== 3);
	levels.addEventListener("change", syncClef);
	syncClef();
	const startBtn = el("button", { type: "button", className: "btn btn-primary", icon: icons.play, text: t("phrases.start") });
	const form = el("section", { "aria-labelledby": "phrase-settings-h", className: "free-form" }, el("h2", { id: "phrase-settings-h", text: t("phrases.settings") }), levels, clefField, el("div", { className: "actions" }, startBtn));
	const drillBox = el("div", { id: "phrase-drill" });
	root.append(howTo(ctx, "phrases", dict.howto.phrases), form, drillBox);
	const begin = () => {
		const config = { level: levelNow(), clef: clefSel.value };
		saveSettings({ phrases: config });
		history.replaceState(null, "", `${location.pathname}?${new URLSearchParams({ level: String(config.level), c: config.clef })}`);
		start(phraseLesson(config.level, config.level === 3 ? config.clef : null), "row", drillBox);
	};
	startBtn.addEventListener("click", () => {
		begin();
		focusHeading(drillBox.querySelector("h2"));
	});
	if (params.has("level")) begin();
}

// ---- the drill ------------------------------------------------------------------------------
let stopPrevious = null;

function start(lesson, mode, container) {
	stopPrevious?.();
	const listeners = new AbortController();
	stopPrevious = () => listeners.abort();
	const { signal } = listeners;
	// Free practice and phrase training are drills on their own page (not a lesson guide):
	// "free" below covers both, `lesson.phrase` tells phrases apart.
	const free = lesson.id === FREE_ID || !!lesson.phrase;
	const tx = lesson.phrase ? { title: t("phrases.drillTitle", { n: lesson.phrase.level }), hint: "" } : free ? { title: t("free.title"), hint: "" } : dict.lessons[lesson.id];
	// Phrases are always read as a row, so their title does not name the mode.
	const title = lesson.phrase ? tx.title : `${tx.title} (${t(`modes.${mode}.label`).toLowerCase()})`;
	if (!free) {
		heading.textContent = title;
		document.title = `${title}, ${t("site.name")}`;
	}
	const progress = aggregate(getProgress());
	const idx = free ? -1 : PITCH_LESSONS.indexOf(lesson);
	const prev = idx > 0 ? PITCH_LESSONS[idx - 1] : null;
	const next = idx >= 0 ? PITCH_LESSONS[idx + 1] : null;

	const back = free ? null : el("p", {}, el("a", { className: "standalone", href: ctx.paths.lesson[lesson.id], text: `${t("drill.backToGuide")}: ${tx.title}` }));
	const notice = prev && (progress.lessons[prev.id]?.single?.best ?? 0) < UNLOCK_PCT ? el("p", { className: "notice", text: t("guide.notYet", { title: dict.lessons[prev.id].title }) }) : null;
	const remember = tx.hint ? el("p", {}, el("strong", { text: t("guide.remember") }), " ", tx.hint) : null;
	// Steps for this mode, with the lesson's worked example where the mode shows notation.
	const helpKey = lesson.staff ? mode : mode === "single" ? "keys" : mode;
	const sig = lesson.exampleKeySig ?? lesson.keySigs?.[0];
	const example = lesson.worked && mode !== "ear" ? workedExample(lesson.worked, { t, noteNames, keySig: sig ? KEY_SIGS[sig].alters : null, verb: mode === "name" ? "choose" : "play" }) : "";
	const guide = free ? null : howTo(ctx, helpKey, dict.howto[helpKey], example);
	const drillHeading = free ? el("h2", { text: title }) : null;
	const count = el("p", { className: "count" });
	const streakLine = el("p", { className: "count" });
	const keySigLine = el("p", { className: "muted" });
	const prompt = el("p", { className: "prompt", "aria-live": "polite" });
	const figure = el("div", { className: "staff-box" });
	const letter = el("p", { className: "name-target", hidden: true });
	const listen = el("button", { type: "button", className: "btn", icon: icons.speakerHigh, text: t("drill.listen") });
	const hintBtn = el("button", { type: "button", className: "btn", icon: icons.lightbulb, text: t("drill.hint") });
	hintBtn.hidden = mode === "ear";
	const answers = el("div", { className: "answers", role: "group", "aria-label": t("drill.answerGroup"), hidden: mode !== "name" });
	const feedback = el("div", { className: "feedback", "aria-live": "polite" });
	const question = el("section", { className: "question", "aria-label": t("drill.promptStaff") }, prompt, keySigLine, figure, letter, answers, el("div", { className: "actions" }, listen, hintBtn), feedback);
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
	container.replaceChildren(...[back, notice, guide, remember, drillHeading, el("div", { className: "drill-head" }, count, streakLine, fullscreenButton(ctx)), question, kbdBox, options, summary].filter(Boolean));

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
	hub.addEventListener(
		"note",
		(e) => {
			keyboard.setOn(e.detail.midi, e.detail.on);
			if (e.detail.on) onNote(e.detail.midi);
		},
		{ signal },
	);

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

	/** Name buttons: the spellings that occur in the pool, ordered by pitch. */
	function buildAnswers(pool) {
		const seen = new Map();
		for (const n of pool) {
			const id = `${n.step}${n.alter}`;
			if (!seen.has(id)) seen.set(id, { step: n.step, alter: n.alter, pc: pitchClass(midiOf({ ...n, octave: 4 })) });
		}
		const list = [...seen.values()].sort((a, b) => a.pc - b.pc || a.alter - b.alter);
		answers.replaceChildren(
			...list.map((a) => {
				const b = el("button", { type: "button", className: "btn answer", text: noteName(a.step, a.alter, noteNames), dataset: { step: a.step, alter: String(a.alter) } });
				b.addEventListener("click", () => onName(a, b));
				return b;
			}),
		);
	}

	function newRound() {
		const keySig = lesson.keySigs ? lesson.keySigs[Math.floor(Math.random() * lesson.keySigs.length)] : null;
		const pool = lesson.pool(keySig).map((n) => ({ ...n, midi: n.octave == null ? null : midiOf(n), key: noteKey(n.step, n.alter, n.octave) }));
		// Phrase training: the round is five generated phrases, each read as one row.
		const phrases = lesson.phrase ? Array.from({ length: PHRASES_PER_ROUND }, () => generatePhrase(lesson.phrase)) : null;
		const total = phrases ? phrases.reduce((a, p) => a + p.notes.length, 0) : mode === "row" ? ROW_LENGTH * 3 : ROUND_SIZE;
		round = { keySig, pool, phrases, total, i: 0, results: [], missed: false, busy: false, row: [], rowPos: 0, target: null, shownAt: 0, prevKey: null, earStarted: mode !== "ear", streak: 0, bestStreak: 0 };
		streakLine.textContent = "";
		keepAwake(true);
		keySigLine.textContent = keySig ? t("drill.keySig", { name: dict.keySigNames[keySig] }) : "";
		if (mode === "name") buildAnswers(pool);
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
		if (round.phrases) {
			const phrase = round.phrases.shift();
			round.row = phrase.notes.map((n) => ({ ...n, key: noteKey(n.step, n.alter, n.octave) }));
			round.rowPos = 0;
			round.keySig = phrase.key === "C" ? null : phrase.key;
			keySigLine.textContent = round.keySig ? t("drill.keySig", { name: dict.keySigNames[round.keySig] }) : "";
			return;
		}
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
		for (const b of answers.children) b.classList.remove("is-target", "is-wrong");
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
			const items = [];
			let beats = 0;
			round.row.forEach((n, i) => {
				items.push({
					type: "note",
					value: n.value ?? "q",
					notes: [n],
					midi: i === round.rowPos ? n.midi : undefined,
					state: i < round.rowPos ? "done" : i === round.rowPos ? (state === "bad" ? "bad" : "current") : "",
				});
				// Phrases are two bars of 4/4: a bar line in the middle, as in real music.
				beats += BEATS[n.value ?? "q"];
				if (round.phrases && beats === 4) items.push({ type: "bar" });
			});
			figure.innerHTML = renderStaff({ staff: lesson.staff, keySig, timeSig: round.phrases ? [4, 4] : null, items, label: t("drill.rowLabel", { n: round.row.length }), className: "staff-row" });
		} else {
			prompt.textContent = mode === "name" ? t("drill.promptName") : t("drill.promptStaff");
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

	hintBtn.addEventListener("click", () => {
		if (!round?.target || round.busy || !summary.hidden || !round.earStarted) return;
		// A hint costs the first try, so weak notes keep their weight.
		if (!round.missed) {
			round.missed = true;
			round.results.push({ key: round.target.key, ok: false, ms: Math.round(performance.now() - round.shownAt) });
			round.streak = 0;
			streakLine.textContent = "";
		}
		feedback.replaceChildren(el("p", {}, el("strong", { text: t("drill.hintLabel") }), " ", explainText(round.target)));
	});

	// Letter keys answer in name mode, only while focus is on the name buttons (WCAG 2.1.4).
	answers.addEventListener("keydown", (e) => {
		if (e.ctrlKey || e.metaKey || e.altKey || noteNames === "solfege") return;
		const k = e.key.toUpperCase();
		const step = noteNames === "h-system" ? (k === "H" ? "B" : k === "B" ? null : k) : k;
		const flatB = noteNames === "h-system" && k === "B";
		const btn = [...answers.children].find((b) => (flatB ? b.dataset.step === "B" && b.dataset.alter === "-1" : b.dataset.step === step && (b.dataset.alter === "0" || !answers.querySelector(`[data-step="${step}"][data-alter="0"]`))));
		if (!btn) return;
		e.preventDefault();
		btn.focus();
		btn.click();
	});

	function matches(target, midi) {
		if (target.midi == null || mode === "name") return pitchClass(midi) === pitchClass(target.midi ?? midiOf({ ...target, octave: 4 }));
		return midi === target.midi;
	}

	function succeed() {
		const target = round.target;
		const ms = Math.round(performance.now() - round.shownAt);
		if (!round.missed) {
			round.results.push({ key: target.key, ok: true, ms });
			round.streak++;
			round.bestStreak = Math.max(round.bestStreak, round.streak);
			streakLine.textContent = round.streak > 1 ? t("drill.streak", { n: round.streak }) : "";
		}
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
	}

	function miss(playedName) {
		const target = round.target;
		if (round.missed) return;
		round.missed = true;
		round.results.push({ key: target.key, ok: false, ms: Math.round(performance.now() - round.shownAt) });
		round.streak = 0;
		streakLine.textContent = "";
		draw("bad");
		feedback.replaceChildren(
			el("p", {}, el("span", { className: "bad", text: t("drill.wrong", { name: nameOf(target) }) }), " ", t(mode === "name" ? "drill.youChose" : "drill.youPlayed", { name: playedName })),
			el("p", { text: explainText(target) }),
			el("p", { text: mode === "name" ? t("drill.chooseCorrect") : t("drill.playCorrect") }),
		);
	}

	function onName(answer, button) {
		if (!round || round.busy || !round.target || !summary.hidden) return;
		const target = round.target;
		const ok = pitchClass(midiOf({ ...answer, octave: 4 })) === pitchClass(target.midi ?? midiOf({ ...target, octave: 4 }));
		if (ok) return succeed();
		button.classList.add("is-wrong");
		for (const b of answers.children) if (b.dataset.step === target.step && Number(b.dataset.alter) === target.alter) b.classList.add("is-target");
		miss(noteName(answer.step, answer.alter, noteNames));
	}

	function onNote(midi) {
		if (!round || round.busy || !round.target || !round.earStarted || !summary.hidden) return;
		const target = round.target;
		if (matches(target, midi)) return succeed();
		keyboard.clearMarks();
		keyboard.mark(midi, "wrong");
		if (target.midi == null || mode === "name") {
			for (let m = keyboard.low; m <= keyboard.high; m++) if (matches(target, m)) keyboard.mark(m, "target");
		} else keyboard.mark(target.midi, "target");
		const spelled = spellMidi(midi);
		miss(noteName(spelled.step, spelled.alter, noteNames));
	}

	function finish() {
		keepAwake(false);
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
		const message = free
			? ""
			: accuracy >= UNLOCK_PCT
				? mode === "single" && before < UNLOCK_PCT && next
					? t("drill.passed", { pct: f.percent(accuracy) })
					: ""
				: t("drill.keepGoing", { pct: f.percent(UNLOCK_PCT) });
		const again = el("button", { type: "button", className: "btn btn-primary", icon: icons.arrowCounterClockwise, text: t("drill.again") });
		again.addEventListener("click", () => {
			newRound();
			focusHeading(free ? drillHeading : heading);
		});
		const changeSettings = free ? el("button", { type: "button", className: "btn", icon: icons.arrowLeft, text: t("free.change") }) : null;
		changeSettings?.addEventListener("click", () => focusHeading($(lesson.phrase ? "#phrase-settings-h" : "#free-settings-h")));
		summary.replaceChildren(
			h,
			el(
				"dl",
				{ className: "facts" },
				el("div", {}, el("dt", { text: t("drill.accuracy") }), el("dd", { text: f.percent(accuracy) })),
				el("div", {}, el("dt", { text: t("drill.typical") }), el("dd", { text: t("drill.seconds", { s: f.seconds(median) }) })),
				el("div", {}, el("dt", { text: t("drill.bestStreak") }), el("dd", { text: f.int(round.bestStreak) })),
			),
			message ? el("p", { text: message }) : null,
			el("h3", { text: t("drill.weakest") }),
			el("p", { text: weak.length ? weak.join(", ") : t("drill.none") }),
			el(
				"div",
				{ className: "actions" },
				again,
				changeSettings,
				free ? null : el("a", { className: "btn", href: ctx.paths.lesson[lesson.id], icon: icons.arrowLeft, text: t("drill.backToGuide") }),
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
