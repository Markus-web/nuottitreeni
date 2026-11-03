// Speed reading (optional, timed): notes from the chosen clef, range and key signature come one
// by one; each right answer shortens the time for the next note by 10 %, a miss or a timeout
// lengthens it again and costs one of three lives. Pause and Stop are always there, the start
// time can be chosen (6, 4 or 2 s), and the untimed drills cover the same skill (WCAG 2.2.1,
// 2.2.3). With reduced motion the time shows as seconds instead of a shrinking bar. The best
// notes per minute are kept per clef in this browser only (setting "speedBest").
import { KEY_SIGS, freeConfig, freeLesson, freeRangeKeys } from "../content/catalog.js";
import { PianoKeyboard } from "../core/keyboard.js";
import { octaveRange } from "../core/keyboard-layout.js";
import { midiLabel, midiOf, noteName, parseNoteKey, pitchClass } from "../core/notes.js";
import { renderStaff } from "../core/staff.js";
import { getSettings, saveSettings } from "../core/store.js";
import { keepAwake } from "../core/wake-lock.js";
import { explainText } from "../core/worked-example.js";
import * as icons from "../content/icons.js";
import { $, boot, el, focusHeading, howTo, setLabel } from "./common.js";

const ctx = await boot();
const { t, f, dict, hub, noteNames } = ctx;
const root = $("#app-root");
const LIVES = 3;
const FASTER = 0.9;
const SLOWER = 1.25;
const MIN_MS = 700;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- settings ----------------------------------------------------------------------------
let config = freeConfig(getSettings().speed ?? {});
const select = (id, options, value) => {
	const s = el("select", { id });
	for (const [v, label] of options) s.append(el("option", { value: String(v), text: label }));
	s.value = String(value);
	return s;
};
const clefSel = select("speed-clef", ["treble", "bass", "grand"].map((c) => [c, t(`free.clef.${c}`)]), config.clef);
const lowSel = el("select", { id: "speed-low" });
const highSel = el("select", { id: "speed-high" });
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
const keySel = select("speed-key", [0, 1, 2, 3, -1, -2, -3].map((v) => [v, sigNames[v]]), config.fifths);
const timeSel = select("speed-time", [6000, 4000, 2000].map((ms) => [ms, t("speed.seconds", { s: ms / 1000 })]), getSettings().speed?.startMs ?? 4000);
const field = (id, label, control) => el("div", { className: "field" }, el("label", { for: id, text: label }), control);
const startBtn = el("button", { type: "button", className: "btn btn-primary", icon: icons.play, text: t("speed.start") });
const form = el(
	"section",
	{ "aria-labelledby": "speed-settings-h", className: "free-form" },
	el("h2", { id: "speed-settings-h", text: t("free.settings") }),
	field("speed-clef", t("free.clefLabel"), clefSel),
	field("speed-low", t("free.low"), lowSel),
	field("speed-high", t("free.high"), highSel),
	field("speed-key", t("free.keySig"), keySel),
	field("speed-time", t("speed.startTime"), timeSel),
	el("div", { className: "actions" }, startBtn),
);

// ---- the game area -------------------------------------------------------------------------
const heading = el("h2", { id: "speed-h", tabindex: "-1", text: t("speed.playing") });
const score = el("p", { className: "count" });
const livesLine = el("p", { className: "count" });
const timeText = el("p", { className: "count" });
const bar = el("div", { className: "speed-bar", "aria-hidden": "true" }, el("div", { className: "speed-bar-fill" }));
const figure = el("div", { className: "staff-box" });
const feedback = el("div", { className: "feedback", "aria-live": "polite" });
const pauseBtn = el("button", { type: "button", className: "btn", icon: icons.pause, text: t("speed.pause") });
const stopBtn = el("button", { type: "button", className: "btn", icon: icons.stop, text: t("speed.stop") });
const kbdBox = el("div");
const result = el("section", { "aria-labelledby": "speed-result-h", hidden: true });
const game = el("section", { "aria-labelledby": "speed-h", hidden: true }, heading, el("div", { className: "drill-head" }, score, livesLine, timeText), reduced ? null : bar, figure, el("div", { className: "actions" }, pauseBtn, stopBtn), feedback, kbdBox);
root.append(howTo(ctx, "speed", dict.howto.speed), form, game, result);
const keyboard = new PianoKeyboard(kbdBox, { t, noteNames, low: 48, high: 83, id: "speed-kbd" });
keyboard.addEventListener("key", (e) => hub.screen(e.detail.midi, e.detail.on));

let s = null; // session state
function nextNote() {
	let n;
	do n = s.pool[Math.floor(Math.random() * s.pool.length)];
	while (s.pool.length > 1 && n.key === s.last);
	s.last = n.key;
	s.target = n;
	s.waiting = false;
	s.left = s.timeMs;
	s.shownAt = performance.now();
	s.pausedFor = 0;
	const sig = KEY_SIGS[s.keySig]?.alters ?? null;
	figure.innerHTML = renderStaff({ staff: s.lesson.staff, keySig: sig, items: [{ type: "note", value: "q", notes: [n], state: "current", midi: n.midi }], label: t("speed.noteLabel") });
	keyboard.clearMarks();
	tick();
}

function tick() {
	if (!s || s.paused) return;
	const left = Math.max(0, s.timeMs - (performance.now() - s.shownAt - s.pausedFor));
	// CSSOM width (the CSP allows it; inline style attributes are not used).
	if (!reduced) bar.firstChild.style.width = `${(100 * left) / s.timeMs}%`;
	timeText.textContent = t("speed.timeLeft", { s: f.seconds(left) });
	if (left <= 0) return answer(null);
	s.raf = requestAnimationFrame(tick);
}

function updateLines() {
	score.textContent = t("speed.score", { n: s.read });
	livesLine.textContent = t("speed.lives", { n: s.lives });
}

function answer(midi) {
	const target = s.target;
	const ok = midi != null && (target.midi == null ? pitchClass(midi) === pitchClass(midiOf({ ...target, octave: 4 })) : midi === target.midi);
	cancelAnimationFrame(s.raf);
	s.waiting = true;
	if (ok) {
		s.read++;
		s.correctMs += performance.now() - s.shownAt - s.pausedFor;
		s.timeMs = Math.max(MIN_MS, s.timeMs * FASTER);
		feedback.replaceChildren();
	} else {
		s.lives--;
		s.timeMs = Math.min(s.startMs, s.timeMs * SLOWER);
		const name = noteName(target.step, target.alter, noteNames);
		feedback.replaceChildren(el("p", {}, el("span", { className: "bad", text: midi == null ? t("speed.timeout", { name }) : t("drill.wrong", { name }) }), " ", explainText(target, t, noteNames)));
		keyboard.mark(target.midi, "target");
	}
	updateLines();
	if (s.lives <= 0) return finish();
	// After a miss, a short pause so the explanation can be read before the next note. The
	// session check keeps a pending note out of a session started again in the meantime.
	const session = s;
	setTimeout(() => s === session && !s.paused && nextNote(), ok ? 150 : 1800);
}

function begin() {
	config = freeConfig({ clef: clefSel.value, low: lowSel.value, high: highSel.value, fifths: Number(keySel.value), accidentals: false, mode: "single" });
	const startMs = Number(timeSel.value);
	saveSettings({ speed: { ...config, startMs } });
	const lesson = freeLesson(config);
	const keySig = lesson.keySigs?.[0] ?? null;
	const pool = lesson.pool(keySig).map((n) => ({ ...n, midi: midiOf(n), key: `${n.step}${n.alter}${n.octave}` }));
	const r = octaveRange(...lesson.range);
	keyboard.setRange(r.low, r.high);
	s = { lesson, keySig, pool, startMs, timeMs: startMs, lives: LIVES, read: 0, correctMs: 0, pausedFor: 0, paused: false, last: null, raf: 0 };
	result.hidden = true;
	game.hidden = false;
	feedback.replaceChildren();
	setLabel(pauseBtn, icons.pause, t("speed.pause"));
	updateLines();
	keepAwake(true);
	focusHeading(heading);
	nextNote();
}

function finish() {
	cancelAnimationFrame(s.raf);
	keepAwake(false);
	const perMinute = s.read ? Math.round((60000 * s.read) / Math.max(1, s.correctMs)) : 0;
	const best = getSettings().speedBest ?? {};
	const record = perMinute > (best[config.clef] ?? 0);
	if (record) saveSettings({ speedBest: { ...best, [config.clef]: perMinute } });
	const h = el("h2", { id: "speed-result-h", tabindex: "-1", text: t("speed.resultHeading") });
	const again = el("button", { type: "button", className: "btn btn-primary", icon: icons.arrowCounterClockwise, text: t("speed.again") });
	again.addEventListener("click", begin);
	result.replaceChildren(
		h,
		el(
			"dl",
			{ className: "facts" },
			el("div", {}, el("dt", { text: t("speed.read") }), el("dd", { text: f.int(s.read) })),
			el("div", {}, el("dt", { text: t("speed.perMinute") }), el("dd", { text: f.int(perMinute) })),
			el("div", {}, el("dt", { text: t("speed.best") }), el("dd", { text: f.int(Math.max(perMinute, best[config.clef] ?? 0)) })),
		),
		record && s.read ? el("p", { className: "ok", text: t("speed.record") }) : null,
		el("div", { className: "actions" }, again),
	);
	game.hidden = true;
	result.hidden = false;
	s = null;
	focusHeading(h);
}

pauseBtn.addEventListener("click", () => {
	if (!s) return;
	if (s.paused) {
		s.pausedFor += performance.now() - s.pauseStart;
		s.paused = false;
		setLabel(pauseBtn, icons.pause, t("speed.pause"));
		// Paused between two notes: go on with a new note, not the one already answered.
		if (s.waiting) nextNote();
		else tick();
	} else {
		s.paused = true;
		s.pauseStart = performance.now();
		cancelAnimationFrame(s.raf);
		setLabel(pauseBtn, icons.play, t("speed.resume"));
	}
});
stopBtn.addEventListener("click", () => s && finish());
startBtn.addEventListener("click", begin);
hub.addEventListener("note", (e) => {
	keyboard.setOn(e.detail.midi, e.detail.on);
	if (e.detail.on && s && !s.paused && !s.waiting && s.target) answer(e.detail.midi);
});
hub.addEventListener("control", (e) => {
	if (e.detail.action === "restart") begin();
	else if (s) pauseBtn.click();
	else begin();
});
