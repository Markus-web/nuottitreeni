// Rhythm practice: /rytmiharjoitus/?l=<rhythm lesson id>
//   quiz  (note values, rests): how many beats? untimed
//   meter (time signatures): how many beats are missing? untimed
//   tap   (optional, timed): play a rhythm with the metronome; tempo adjustable 40-120
import { RHYTHM_LESSONS } from "../content/catalog.js";
import { parseMelody, toStaffItems } from "../core/notation.js";
import { recordRound } from "../core/progress.js";
import { Metronome } from "../core/sound.js";
import { renderStaff } from "../core/staff.js";
import { getDeviceId, getProgress, saveProgress } from "../core/store.js";
import * as icons from "../content/icons.js";
import { $, boot, el, focusHeading } from "./common.js";

const QUESTIONS = 10;
const ctx = await boot();
const { t, f, hub, sound, dict } = ctx;
const root = $("#app-root");
const heading = $("#page-title");
const lesson = RHYTHM_LESSONS.find((r) => r.id === new URLSearchParams(location.search).get("l"));

if (!lesson) root.append(el("p", { className: "notice", text: t("drill.noLesson") }), el("p", {}, el("a", { className: "standalone", href: ctx.paths.home, text: t("common.home") })));
else start();

function answerLabel(n) {
	return n === 0.5 ? t("rhythmUi.answerHalf") : n === 1 ? t("rhythmUi.answerOneBeat") : t("rhythmUi.answerBeats", { n });
}

function start() {
	const tx = dict.rhythm[lesson.id];
	heading.textContent = tx.title;
	document.title = `${tx.title}, ${t("site.name")}`;
	root.append(el("p", {}, el("a", { className: "standalone", href: ctx.paths.rhythm[lesson.id], text: `${t("drill.backToGuide")}: ${tx.title}` })));
	if (lesson.kind === "tap") tapMode(tx);
	else quizMode(tx);
}

function summaryView(section, accuracy, again) {
	const h = el("h2", { id: "summary-h", text: t("drill.summary") });
	const btn = el("button", { type: "button", className: "btn btn-primary", icon: icons.arrowCounterClockwise, text: t("drill.again") });
	btn.addEventListener("click", again);
	section.replaceChildren(h, el("dl", { className: "facts" }, el("div", {}, el("dt", { text: t("drill.accuracy") }), el("dd", { text: f.percent(accuracy) }))), el("div", { className: "actions" }, btn, el("a", { className: "btn", href: ctx.paths.home, icon: icons.house, text: t("common.home") })));
	focusHeading(h);
}

function quizMode(tx) {
	const count = el("p", { className: "count" });
	const prompt = el("p", { className: "prompt", text: tx.question });
	const figure = el("div");
	const answers = el("ul", { className: "answers" });
	const feedback = el("div", { className: "feedback", "aria-live": "polite" });
	const box = el("section", { className: "question", "aria-label": tx.question }, prompt, figure, answers, feedback);
	root.append(count, box);
	let i = 0;
	let correct = 0;
	let current = null;
	let answered = false;

	function question() {
		if (i >= QUESTIONS) {
			const accuracy = Math.round((100 * correct) / QUESTIONS);
			saveProgress(recordRound(getProgress(), getDeviceId(), { kind: "rhythm", id: lesson.id, mode: "quiz", accuracy }, Date.now()));
			box.hidden = true;
			count.textContent = "";
			summaryView(box.parentNode.appendChild(el("section", { "aria-labelledby": "summary-h" })), accuracy, () => location.reload());
			return;
		}
		answered = false;
		feedback.replaceChildren();
		count.textContent = t("drill.count", { i: i + 1, n: QUESTIONS });
		if (lesson.kind === "meter") {
			current = lesson.bars[Math.floor(Math.random() * lesson.bars.length)];
			figure.innerHTML = renderStaff({ staff: "treble", timeSig: current.time, items: toStaffItems(parseMelody(current.melody), "treble"), label: tx.question });
			current = { ...current, answer: current.missing };
		} else {
			const it = lesson.items[Math.floor(Math.random() * lesson.items.length)];
			const item = it.rest ? { type: "rest", value: it.value, clef: "treble" } : { type: "note", value: it.value, notes: [{ step: "B", alter: 0, octave: 4, clef: "treble", written: null }] };
			figure.innerHTML = renderStaff({ staff: "treble", items: [item], label: tx.question });
			current = { answer: it.beats };
		}
		answers.replaceChildren(
			...lesson.answers.map((a) => {
				const b = el("button", { type: "button", className: "btn", text: answerLabel(a) });
				b.addEventListener("click", () => answer(a));
				return el("li", {}, b);
			}),
		);
	}

	function answer(a) {
		if (answered) return;
		answered = true;
		const ok = a === current.answer;
		if (ok) correct++;
		feedback.replaceChildren(el("p", { className: ok ? "ok" : "bad", text: ok ? t("rhythmUi.correct") : t("rhythmUi.wrong", { answer: answerLabel(current.answer) }) }));
		const next = el("button", { type: "button", className: "btn btn-primary", icon: icons.arrowRight, text: t("common.next") });
		next.addEventListener("click", () => {
			i++;
			question();
			answers.querySelector("button")?.focus();
		});
		feedback.append(next);
		next.focus();
	}

	question();
}

function tapMode(tx) {
	const metronome = new Metronome(sound);
	const tempo = el("input", { type: "range", min: "40", max: "120", step: "5", value: "60", id: "tempo" });
	const tempoOut = el("output", { for: "tempo", text: "60" });
	tempo.addEventListener("input", () => (tempoOut.textContent = tempo.value));
	const prompt = el("p", { className: "prompt", text: tx.question });
	const figure = el("div");
	const beat = el("p", { className: "count", "aria-live": "off" });
	const startBtn = el("button", { type: "button", className: "btn btn-primary", icon: icons.play, text: t("rhythmUi.start") });
	const tapBtn = el("button", { type: "button", className: "btn", text: t("rhythmUi.playing"), disabled: true });
	const newBtn = el("button", { type: "button", className: "btn", icon: icons.shuffle, text: t("rhythmUi.newPattern") });
	const results = el("div", { "aria-live": "polite" });
	root.append(
		el("div", { className: "field" }, el("label", { for: "tempo", text: t("rhythmUi.tempo") }), tempo, " ", tempoOut),
		el("section", { className: "question", "aria-label": tx.question }, prompt, figure, beat, el("div", { className: "actions" }, startBtn, tapBtn, newBtn), results),
	);
	let pattern = lesson.patterns[Math.floor(Math.random() * lesson.patterns.length)];
	const draw = () => (figure.innerHTML = renderStaff({ staff: "treble", timeSig: [4, 4], items: toStaffItems(parseMelody(pattern), "treble"), label: tx.question }));
	draw();
	newBtn.addEventListener("click", () => {
		const others = lesson.patterns.filter((p) => p !== pattern);
		pattern = others[Math.floor(Math.random() * others.length)];
		results.replaceChildren();
		draw();
	});
	let expected = [];
	let taps = [];
	let running = false;

	function tap(time = performance.now()) {
		if (running) taps.push(time);
	}
	hub.addEventListener("note", (e) => e.detail.on && tap());
	tapBtn.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		tap();
	});
	tapBtn.addEventListener("keydown", (e) => {
		if ((e.key === " " || e.key === "Enter") && !e.repeat) {
			e.preventDefault();
			tap();
		}
	});

	startBtn.addEventListener("click", () => {
		const bpm = Number(tempo.value);
		const spb = 60000 / bpm;
		const items = parseMelody(pattern).filter((it) => it.type !== "bar");
		let beatPos = 0;
		const onsets = [];
		for (const it of items) {
			if (it.type === "note") onsets.push(beatPos);
			beatPos += it.beats;
		}
		taps = [];
		expected = [];
		running = true;
		startBtn.disabled = true;
		newBtn.disabled = true;
		tapBtn.disabled = false;
		tapBtn.focus();
		results.replaceChildren();
		let t0 = null;
		metronome.start({
			bpm,
			beatsPerBar: 4,
			beats: 8,
			onBeat: ({ index, perfTime }) => {
				setTimeout(() => (beat.textContent = index < 4 ? `${t("rhythmUi.countIn")} ${index + 1}` : t("rhythmUi.beat", { n: index - 3 })), Math.max(0, perfTime - performance.now()));
				if (index === 4) {
					t0 = perfTime;
					expected = onsets.map((b) => t0 + b * spb);
				}
			},
		});
		setTimeout(() => finish(spb), (8 * 60000) / bpm + 400);
	});

	function finish(spb) {
		running = false;
		metronome.stop();
		startBtn.disabled = false;
		newBtn.disabled = false;
		tapBtn.disabled = true;
		const window = Math.max(80, spb * 0.12);
		const used = new Set();
		let ok = 0;
		const lines = expected.map((time, i) => {
			let best = -1;
			for (let j = 0; j < taps.length; j++) if (!used.has(j) && (best < 0 || Math.abs(taps[j] - time) < Math.abs(taps[best] - time))) best = j;
			const diff = best >= 0 ? taps[best] - time : null;
			let result;
			if (diff == null || Math.abs(diff) > spb / 2) result = t("rhythmUi.missed");
			else {
				used.add(best);
				result = Math.abs(diff) <= window ? t("rhythmUi.onTime") : diff < 0 ? t("rhythmUi.early") : t("rhythmUi.late");
				if (Math.abs(diff) <= window) ok++;
			}
			return el("li", { text: t("rhythmUi.resultLine", { i: i + 1, result }) });
		});
		const accuracy = Math.round((100 * ok) / Math.max(1, expected.length));
		saveProgress(recordRound(getProgress(), getDeviceId(), { kind: "rhythm", id: lesson.id, mode: "tap", accuracy }, Date.now()));
		results.replaceChildren(el("p", { text: t("rhythmUi.score", { ok, n: expected.length }) }), el("ol", { className: "results" }, ...lines));
		beat.textContent = "";
		startBtn.focus();
	}
}
