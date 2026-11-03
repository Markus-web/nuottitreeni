// Piece practice.
//   Built-in pieces (/kappaleet/<slug>/): engraved at build time with the own renderer (fast,
//   no 1.4 MB engine); the page re-renders the systems to mark the current note. Three pieces
//   have a bass line and a two-staff score. A built-in piece can be played in another key
//   (src/core/transpose.js); the choice is remembered per piece.
//   Imported MusicXML/MXL (/oma-kappale/?id=): OpenSheetMusicDisplay, loaded only here.
//   Imported MIDI: own grand-staff view of the next steps.
// Wait mode (default, untimed): a step advances when all its notes are played, any order.
// Tempo mode (optional): metronome with count-in; each note is judged against its beat
// (src/core/timing.js) and the run gets a score.
// One hand: the app can play the other hand (play-along), also through the MIDI output.
// View options (saved in settings): note names and suggested fingering on built-in scores,
// falling notes above the keyboard (with labels), colours, marks on the next keys; the score
// can be printed or shown full screen. Bars can be chosen on a bar strip.
// Range warning: when the connected keyboard's size is known (Devices page, or a known model),
// notes the piece needs beyond its keys are named, with the octave shift as the fix.
// Control keys (Devices page) start, stop and restart from the instrument; key lights show the
// next notes on lighted keyboards; the screen stays on while practising.
import { PIECES, altersFor } from "../content/catalog.js";
import { suggestFingers } from "../core/fingering.js";
import { PianoKeyboard } from "../core/keyboard.js";
import { knownKeyboardSize, playableRange } from "../core/keyboard-layout.js";
import { KeyLights } from "../core/key-lights.js";
import { parseMelody, pieceSteps, systems } from "../core/notation.js";
import { midiLabel, noteName, spellMidi } from "../core/notes.js";
import { keyName, pieceCaption, pieceTextLines } from "../core/piece-text.js";
import { recordPiece } from "../core/progress.js";
import { Metronome } from "../core/sound.js";
import { renderStaff } from "../core/staff.js";
import { addPieceRun, getDeviceId, getDeviceSettings, getPieceRuns, getProgress, getSettings, idb, saveProgress, saveSettings } from "../core/store.js";
import { judgeTiming, pieceScore } from "../core/timing.js";
import { keepAwake } from "../core/wake-lock.js";
import * as icons from "../content/icons.js";
import { $, boot, el, howTo, setLabel } from "./common.js";
import { fullscreenButton } from "./fullscreen.js";

const ctx = await boot();
const { t, f, hub, sound, noteNames, cfg, dict } = ctx;
const root = $("#app-root");
const original = cfg.data?.piece ? PIECES.find((p) => p.id === cfg.data.piece) : null;
const lights = new KeyLights(hub);
const MAX_STRIP_BARS = 64;

/** Engine for a built-in piece (own renderer), possibly transposed. */
function builtInEngine(piece) {
	const alters = altersFor(piece.fifths);
	const steps = pieceSteps(piece);
	// Suggested fingering for the melody: the top note of each step gets the finger.
	const melody = parseMelody(piece.right).filter((it) => it.type === "note");
	const fingers = suggestFingers(melody.map((it) => it.notes[it.notes.length - 1]));
	steps.forEach((s, i) => {
		const right = s.notes.filter((n) => n.hand === "right");
		if (right.length) right[right.length - 1].finger = fingers[i];
	});
	const box = $("#score");
	const lines = systems(piece.right, { alters, left: piece.left });
	const title = dict.piecesMeta[piece.id].title;
	let last = -1;
	const show = (current) => {
		last = current;
		const { scoreNames, scoreFingers } = getSettings();
		box.innerHTML = lines
			.map((sys, li) => {
				let step = sys.firstStep;
				const items = sys.items.map((it) => {
					if (it.type !== "note") return it;
					const i = step++;
					return {
						...it,
						state: i < current ? "done" : i === current ? "current" : "",
						midi: i === current ? steps[i]?.notes[0].midi : undefined,
						label: scoreNames ? it.notes.filter((n) => n.clef === "treble").map((n) => noteName(n.step, n.alter, noteNames)).join("+") : undefined,
						finger: scoreFingers ? fingers[i] : undefined,
					};
				});
				return renderStaff({
					staff: piece.left ? "grand" : "treble",
					keySig: Object.keys(alters).length ? alters : null,
					timeSig: li === 0 ? piece.time : null,
					items,
					label: `${title}, ${t("piece.bar", { n: sys.firstBar })}`,
					barNumber: sys.firstBar,
					scale: 1,
					className: "staff-system",
				});
			})
			.join("");
		box.querySelector(".is-current")?.scrollIntoView({ block: "nearest", inline: "center" });
	};
	return { steps, show, redraw: () => show(last), piece, alters, tempo: piece.tempo };
}

/**
 * Engine for an imported file: MIDI (own grand staff) or MusicXML/MXL (OpenSheetMusicDisplay).
 * The readers are loaded only here, so built-in piece pages stay small.
 */
async function importedEngine() {
	const id = new URLSearchParams(location.search).get("id");
	const rec = id ? await idb.get("pieces", id).catch(() => null) : null;
	if (!rec) return null;
	$("#page-title").textContent = rec.name;
	document.title = `${rec.name}, ${t("site.name")}`;
	const box = el("div", { id: "score", className: "score" });
	root.before(el("figure", { className: "figure", tabindex: "0" }, box, el("figcaption", { text: rec.name })));
	if (rec.kind === "midi") {
		const { parseSmf, toSteps } = await import("../core/smf.js");
		const parsed = parseSmf(rec.data);
		const steps = toSteps(parsed).map((s, i) => ({ notes: s.notes, bar: Math.floor(i / 4) + 1, beat: s.ms / 500, iter: i }));
		const show = (current) => {
			const view = steps.slice(Math.max(0, current), Math.max(0, current) + 8).map((s, k) => ({
				type: "note",
				value: "q",
				state: k === 0 && current >= 0 ? "current" : "",
				notes: s.notes.map((n) => ({ ...spellMidi(n.midi), clef: n.midi >= 60 ? "treble" : "bass", written: [1, 3, 6, 8, 10].includes(n.midi % 12) ? 1 : null })),
			}));
			box.innerHTML = renderStaff({ staff: "grand", items: view, label: rec.name });
		};
		show(0);
		return { steps, show, name: rec.name };
	}
	box.textContent = t("piece.loadingScore");
	const { cursorTo, createScore, extractSteps, loadScore, recolor, toBinaryString } = await import("../core/score.js");
	const osmd = await createScore(box, cfg.osmd);
	box.textContent = "";
	await loadScore(osmd, rec.kind === "mxl" ? toBinaryString(rec.data) : rec.data);
	addEventListener("nt-theme", () => recolor(osmd));
	const steps = extractSteps(osmd);
	return { steps, show: (current) => steps[current] && cursorTo(osmd, steps[current].iter), name: rec.name };
}

/** Text alternative and caption of a (possibly transposed) built-in piece. */
function updatePieceText(piece) {
	const caption = $("#score-figure figcaption");
	if (caption) caption.textContent = pieceCaption(piece, dict.piecesMeta[piece.id].title, t, dict);
	$("#piece-text ol")?.replaceChildren(...pieceTextLines(piece, t, noteNames).map((line) => el("li", { text: line })));
}

let teardown = null;
function start(engine) {
	teardown?.();
	root.replaceChildren();
	teardown = setup(engine);
}

// Keys offered for transposing (src/core/transpose.js TRANSPOSE_FIFTHS); the transposer itself
// loads only when a key other than the original is used.
const TRANSPOSE_FIFTHS = [-3, -2, -1, 0, 1, 2, 3];
const inKey = async (piece, fifths) => (fifths === piece.fifths ? piece : (await import("../core/transpose.js")).transposePiece(piece, fifths));

if (original) {
	// Key choice: kept outside the practice area, which is rebuilt when the key changes.
	const keyOf = () => {
		const k = getSettings().pieceKeys?.[original.id];
		return TRANSPOSE_FIFTHS.includes(k) ? k : original.fifths;
	};
	const select = el("select", { id: "piece-key" });
	for (const fifths of TRANSPOSE_FIFTHS) {
		const name = keyName(original, dict, fifths);
		select.append(el("option", { value: String(fifths), text: fifths === original.fifths ? t("piece.keyOriginal", { key: name }) : name }));
	}
	select.value = String(keyOf());
	const field = el("div", { className: "field" }, el("label", { for: "piece-key", text: t("piece.keyLabel") }), select);
	$("#piece-text").after(field);
	const load = async () => {
		const piece = await inKey(original, keyOf());
		const engine = builtInEngine(piece);
		if (piece !== original) {
			updatePieceText(piece);
			engine.show(-1);
		}
		start(engine);
	};
	select.addEventListener("change", async () => {
		saveSettings({ pieceKeys: { ...getSettings().pieceKeys, [original.id]: Number(select.value) } });
		const piece = await inKey(original, Number(select.value));
		updatePieceText(piece);
		const engine = builtInEngine(piece);
		engine.show(-1);
		start(engine);
	});
	await load().catch(() => failed());
} else {
	let engine = null;
	try {
		engine = await importedEngine();
	} catch {
		engine = null;
	}
	if (!engine || !engine.steps.length) failed();
	else start(engine);
}

function failed() {
	root.replaceChildren(el("p", { className: "notice", text: original ? t("piece.scoreFailed") : t("pieces.importFailed") }), el("p", {}, el("a", { className: "standalone", href: ctx.paths.pieces, text: t("pieces.title") })));
}

/** Build the practice area for an engine. Returns a teardown function (listeners, timers, sound). */
function setup({ steps, show, redraw, piece = null, alters = {}, tempo: suggested = null }) {
	const listeners = new AbortController();
	const { signal } = listeners;
	const status = el("p", { className: "count" });
	const feedback = el("div", { className: "feedback", "aria-live": "polite" });
	if (!piece) {
		// Text alternative for imported files, built from the steps (built-ins have one in the page).
		const byBar = new Map();
		for (const s of steps) byBar.set(s.bar, [...(byBar.get(s.bar) ?? []), s.notes.map((n) => midiLabel(n.midi, noteNames)).join("+")]);
		root.append(el("details", {}, el("summary", { text: t("piece.asText") }), el("ol", { className: "results" }, ...[...byBar].map(([bar, items]) => el("li", { text: `${t("piece.bar", { n: bar })}: ${items.join(", ")}` })))));
	}
	const maxBar = steps[steps.length - 1].bar;
	const hasLeft = steps.some((s) => s.notes.some((n) => n.hand === "left"));
	const all = steps.flatMap((s) => s.notes.map((n) => n.midi));
	const low = Math.max(21, Math.min(...all) - (Math.min(...all) % 12));
	const high = Math.min(108, Math.max(...all) + (11 - (Math.max(...all) % 12)));

	const radio = (name, value, label, checked) => {
		const input = el("input", { type: "radio", name, value });
		input.checked = checked;
		return el("label", { className: "check" }, input, label);
	};
	const check = (key, label, onChange) => {
		const input = el("input", { type: "checkbox" });
		input.checked = getSettings()[key];
		input.addEventListener("change", () => {
			saveSettings({ [key]: input.checked });
			onChange?.(input.checked);
		});
		return el("label", { className: "check" }, input, label);
	};
	const modeSet = el("fieldset", {}, el("legend", { text: t("piece.mode") }), radio("mode", "wait", t("piece.modeWait"), true), radio("mode", "tempo", t("piece.modeTempo"), false));
	const handSet = hasLeft
		? el(
				"fieldset",
				{},
				el("legend", { text: t("piece.hands") }),
				radio("hands", "both", t("piece.both"), true),
				radio("hands", "right", t("piece.right"), false),
				radio("hands", "left", t("piece.left"), false),
				check("playAlong", t("piece.playAlong")),
			)
		: null;

	// Bars: two number fields and a strip of bar buttons that set the same range.
	const fromInput = el("input", { type: "number", id: "from-bar", min: "1", max: String(maxBar), value: "1" });
	const toInput = el("input", { type: "number", id: "to-bar", min: "1", max: String(maxBar), value: String(maxBar) });
	const strip = maxBar > 1 && maxBar <= MAX_STRIP_BARS ? el("div", { className: "bar-strip", role: "group", "aria-labelledby": "bar-strip-h" }) : null;
	let anchor = null;
	const range = () => {
		const from = Math.max(1, Math.min(maxBar, Number(fromInput.value) || 1));
		return [from, Math.max(from, Math.min(maxBar, Number(toInput.value) || maxBar))];
	};
	const paintStrip = () => {
		if (!strip) return;
		const [from, to] = range();
		for (const b of strip.children) b.setAttribute("aria-pressed", String(Number(b.dataset.bar) >= from && Number(b.dataset.bar) <= to));
	};
	if (strip) {
		for (let n = 1; n <= maxBar; n++) {
			const b = el("button", { type: "button", className: "bar-button", text: String(n), "aria-label": t("piece.bar", { n }), dataset: { bar: String(n) } });
			b.addEventListener("click", () => {
				// The first press chooses one end, the second the other.
				if (anchor == null) {
					fromInput.value = toInput.value = String(n);
					anchor = n;
				} else {
					fromInput.value = String(Math.min(anchor, n));
					toInput.value = String(Math.max(anchor, n));
					anchor = null;
				}
				paintStrip();
			});
			strip.append(b);
		}
		for (const input of [fromInput, toInput]) input.addEventListener("input", () => ((anchor = null), paintStrip()), { signal });
		paintStrip();
	}
	const loop = el("input", { type: "checkbox" });

	// Tempo: a slider, and speed buttons relative to the piece's suggested tempo.
	const clampTempo = (bpm) => String(Math.max(40, Math.min(160, Math.round(bpm / 5) * 5)));
	const tempo = el("input", { type: "range", id: "piece-tempo", min: "40", max: "160", step: "5", value: suggested ? clampTempo(suggested * 0.75) : "80" });
	const tempoOut = el("output", { for: "piece-tempo", text: tempo.value });
	tempo.addEventListener("input", () => (tempoOut.textContent = tempo.value));
	const speeds = suggested
		? el(
				"div",
				{ className: "actions", role: "group", "aria-label": t("piece.speedGroup", { bpm: suggested }) },
				...[50, 75, 100].map((pct) => {
					const b = el("button", { type: "button", className: "btn", text: f.percent(pct) });
					b.addEventListener("click", () => {
						tempo.value = clampTempo((suggested * pct) / 100);
						tempoOut.textContent = tempo.value;
					});
					return b;
				}),
			)
		: null;

	const startBtn = el("button", { type: "button", className: "btn btn-primary", icon: icons.play, text: t("piece.practice") });
	const listenBtn = el("button", { type: "button", className: "btn", icon: icons.speakerHigh, text: t("piece.listen") });
	const stopBtn = el("button", { type: "button", className: "btn", icon: icons.stop, text: t("piece.stop") });
	const printBtn = el("button", { type: "button", className: "btn", icon: icons.printer, text: t("piece.print") });
	printBtn.addEventListener("click", () => window.print());

	const select = (id, key, label, options, onChange) => {
		const s = el("select", { id });
		for (const [v, label] of options) s.append(el("option", { value: v, text: label }));
		s.value = getSettings()[key];
		s.addEventListener("change", () => {
			saveSettings({ [key]: s.value });
			onChange(s.value);
		});
		return el("div", { className: "field" }, el("label", { for: id, text: label }), s);
	};
	const viewSet = el(
		"fieldset",
		{},
		el("legend", { text: t("piece.viewHeading") }),
		redraw ? check("scoreNames", t("piece.showNames"), () => redraw()) : null,
		redraw ? check("scoreFingers", t("piece.showFingers"), () => redraw()) : null,
		check("nextNotes", t("piece.nextNotes"), (on) => !on && keyboard.clearMarks()),
		check("fallingNotes", t("piece.falling"), (on) => setFalling(on)),
		select("piece-falling-labels", "fallingLabels", t("piece.fallingLabels"), ["none", "names", "fingers"].map((v) => [v, t(`piece.fallingLabelsOptions.${v}`)]), (v) => {
			falling?.setLabels(v);
			falling?.draw(falling.lastBeat ?? steps[0].beat);
		}),
		select("piece-colors", "noteColors", t("piece.noteColors"), ["off", "names", "hands", "fingers"].map((v) => [v, t(`settings.noteColorsOptions.${v}`)]), (v) => {
			if (v === "off") document.documentElement.removeAttribute("data-note-colors");
			else document.documentElement.setAttribute("data-note-colors", v);
			falling?.draw(falling.lastBeat ?? steps[0].beat);
		}),
	);
	const kbdBox = el("div");
	const rangeNote = el("p", { className: "notice", hidden: true });
	const history = piece ? el("section", { "aria-labelledby": "history-h" }) : null;
	root.append(
		...[el("h2", { id: "practice-h", text: t("piece.practice") }), howTo(ctx, "piece", dict.howto.piece), modeSet, handSet].filter(Boolean),
		el("div", { className: "field" }, el("label", { for: "from-bar", text: t("piece.fromBar") }), fromInput),
		el("div", { className: "field" }, el("label", { for: "to-bar", text: t("piece.toBar") }), toInput),
		...(strip ? [el("p", { id: "bar-strip-h", className: "hint", text: t("piece.barStrip") }), strip] : []),
		el("label", { className: "check" }, loop, t("piece.loop")),
		el("div", { className: "field" }, el("label", { for: "piece-tempo", text: t("piece.tempo") }), tempo, " ", tempoOut),
		...(speeds ? [speeds] : []),
		el("div", { className: "actions" }, ...[startBtn, listenBtn, stopBtn, printBtn, fullscreenButton(ctx)].filter(Boolean)),
		viewSet,
		status,
		feedback,
		rangeNote,
		kbdBox,
		...(history ? [history] : []),
	);
	const needed = [...new Set(all)].sort((a, b) => a - b);
	function checkRange() {
		let found = null;
		for (const i of hub.inputs()) {
			if (i.kind === "mic") continue;
			const d = getDeviceSettings(i.key);
			const keys = d.keys ?? knownKeyboardSize(i.name);
			if (!keys) continue;
			const [lo, hi] = playableRange(keys, d.octave, d.transpose);
			const missing = needed.filter((m) => m < lo || m > hi);
			if (missing.length) found = { keys, lo, hi, missing };
		}
		rangeNote.hidden = !found;
		if (found) rangeNote.textContent = t("piece.rangeWarning", { notes: found.missing.map((m) => midiLabel(m, noteNames)).join(", "), keys: found.keys, low: midiLabel(found.lo, noteNames), high: midiLabel(found.hi, noteNames) });
	}
	hub.addEventListener("status", checkRange, { signal });
	checkRange();
	const flats = Object.values(alters).some((a) => a < 0);
	const keyboard = new PianoKeyboard(kbdBox, { t, noteNames, low, high, id: "piece-kbd", prefer: flats ? "flat" : "sharp" });
	keyboard.addEventListener("key", (e) => hub.screen(e.detail.midi, e.detail.on));

	// Falling notes: off by default (loaded only when on); move only while a tempo run or Listen plays.
	let falling = null;
	async function setFalling(on) {
		if (on && !falling) {
			const { FallingNotes } = await import("../core/falling.js");
			if (falling || signal.aborted) return;
			falling = new FallingNotes(keyboard);
			falling.setLabels(getSettings().fallingLabels);
			falling.setSteps(steps);
			falling.draw(steps[0].beat);
		} else if (!on && falling) {
			falling.destroy();
			falling = null;
		}
	}
	setFalling(getSettings().fallingNotes);
	// Saved view options apply at once (the page arrives with the plain build-time score).
	if (redraw && (getSettings().scoreNames || getSettings().scoreFingers)) redraw();

	// History of this browser's runs (built-in pieces).
	function renderHistory() {
		if (!history) return;
		const runs = getPieceRuns(piece.id);
		const head = el("h3", { id: "history-h", text: t("piece.historyHeading") });
		const explain = el("details", {}, el("summary", { text: t("piece.scoreHelp") }), el("p", { text: t("piece.scoreHelpText") }));
		if (!runs.length) return history.replaceChildren(head, el("p", { text: t("piece.historyEmpty") }), explain);
		const th = (key) => el("th", { scope: "col", text: t(key) });
		const table = el(
			"table",
			{},
			el("caption", { className: "visually-hidden", text: t("piece.historyHeading") }),
			el("thead", {}, el("tr", {}, th("piece.historyDate"), th("piece.historyMode"), th("piece.historyTempo"), th("piece.historyScore"), th("piece.historyWrong"))),
			el(
				"tbody",
				{},
				...runs.map((r) =>
					el(
						"tr",
						{},
						el("td", { text: f.dateTime(r.at) }),
						el("td", { text: r.mode === "tempo" ? t("piece.modeTempoShort") : t("piece.modeWaitShort") }),
						el("td", { text: r.tempo ? String(r.tempo) : "-" }),
						el("td", { text: String(r.score) }),
						el("td", { text: String(r.wrong) }),
					),
				),
			),
		);
		history.replaceChildren(head, el("div", { className: "table-wrap", tabindex: "0", role: "region", "aria-labelledby": "history-h" }, table), explain);
	}
	renderHistory();
	function saveRun(run) {
		if (!piece) return;
		saveProgress(recordPiece(getProgress(), getDeviceId(), { id: piece.id, wrong: run.wrong }, Date.now()));
		addPieceRun(piece.id, { at: Date.now(), ...run });
		renderHistory();
	}

	const value = (name) => root.querySelector(`input[name="${name}"]:checked`)?.value ?? "both";
	/** Steps in the chosen bars: `own` with the chosen hand's notes, `full` with every note. */
	function chosenSteps() {
		const [from, to] = range();
		const hands = value("hands");
		const full = steps.filter((s) => s.bar >= from && s.bar <= to);
		const own = full.map((s) => ({ ...s, notes: s.notes.filter((n) => hands === "both" || n.hand === hands) })).filter((s) => s.notes.length);
		return { own, full, hands };
	}

	// Play-along: the other hand's notes from beat `from` up to (not including) beat `to`.
	let playAlongStops = [];
	function playOther(full, hands, from, to, spb) {
		if (hands === "both" || !getSettings().playAlong) return;
		const notes = [];
		for (const s of full) {
			if (s.beat < from || (to != null && s.beat >= to)) continue;
			for (const n of s.notes) if (n.hand !== hands) notes.push({ midi: n.midi, at: ((s.beat - from) * spb) / 1000, dur: (Math.max(0.5, n.dur ?? 1) * spb * 0.95) / 1000, vel: 70 });
		}
		if (notes.length) playAlongStops.push(sound.sequence(notes));
	}

	function showStep(list, i) {
		keyboard.clearMarks();
		const step = list[i];
		if (!step) return lights.clear();
		if (getSettings().nextNotes) for (const n of step.notes) keyboard.mark(n.midi, "target", { hand: n.hand, finger: n.finger });
		lights.show(step.notes.map((n) => n.midi));
		keyboard.scrollTo(step.notes[0].midi);
		if (falling && !falling.raf) falling.draw(step.beat);
		status.textContent = t("piece.progress", { i: i + 1, n: list.length });
		show(step.iter);
	}

	let session = null;
	let stopTempo = null;
	let stopListen = null;
	let run = 0; // increases on every stop, so a pending loop restart knows it was cancelled
	// While practice runs, the start button restarts from the first chosen bar.
	const running = (on) => setLabel(startBtn, on ? icons.arrowCounterClockwise : icons.play, on ? t("piece.restart") : t("piece.practice"));
	function stopAll() {
		run++;
		running(false);
		falling?.stop();
		session = null;
		stopTempo?.();
		stopTempo = null;
		stopListen?.();
		stopListen = null;
		for (const stop of playAlongStops) stop();
		playAlongStops = [];
		keyboard.clearMarks();
		lights.clear();
		keepAwake(false);
	}

	const spbNow = () => 60000 / Number(tempo.value);
	function startWait() {
		const { own, full, hands } = chosenSteps();
		session = { list: own, full, hands, i: 0, pressed: new Set(), wrong: 0, notes: own.reduce((a, s) => a + s.notes.length, 0) };
		falling?.setSteps(own);
		feedback.replaceChildren();
		running(true);
		keepAwake(true);
		showStep(own, 0);
		keyboard.setFocus(own[0].notes[0].midi, true);
	}

	hub.addEventListener(
		"note",
		(e) => {
			keyboard.setOn(e.detail.midi, e.detail.on);
			if (!e.detail.on || !session || session.tempo) return;
			const step = session.list[session.i];
			if (!step) return;
			const midi = e.detail.midi;
			if (step.notes.some((n) => n.midi === midi)) {
				session.pressed.add(midi);
				if (step.notes.every((n) => session.pressed.has(n.midi))) {
					// The other hand sounds with this step, up to the next step of the practised hand.
					playOther(session.full, session.hands, step.beat, session.list[session.i + 1]?.beat ?? null, spbNow());
					session.i++;
					session.pressed = new Set();
					if (session.i >= session.list.length) finishWait();
					else showStep(session.list, session.i);
				}
			} else {
				session.wrong++;
				feedback.replaceChildren(el("p", { className: "bad", text: t("piece.wrongNote", { name: midiLabel(midi, noteNames) }) }));
				keyboard.mark(midi, "wrong");
				setTimeout(() => keyboard.marks.get(midi) === "wrong" && keyboard.mark(midi, null), 700);
			}
		},
		{ signal },
	);

	function finishWait() {
		const { wrong, notes } = session;
		const score = pieceScore({ mode: "wait", notes, wrong });
		feedback.replaceChildren(el("p", { className: "ok", text: `${t("piece.done", { wrong })} ${t("piece.score", { score })}` }));
		keyboard.clearMarks();
		lights.clear();
		show(-1);
		saveRun({ mode: "wait", tempo: null, score, wrong });
		if (loop.checked) {
			const thisRun = run;
			setTimeout(() => run === thisRun && startWait(), 1200);
		} else {
			session = null;
			running(false);
			keepAwake(false);
		}
	}

	function timeline(list) {
		const bpm = Number(tempo.value);
		const spb = 60000 / bpm;
		const first = list[0].beat;
		return { spb, times: list.map((s) => (s.beat - first) * spb), bpm };
	}

	function startTempo() {
		const { own: list, full, hands } = chosenSteps();
		const { spb, times, bpm } = timeline(list);
		const metronome = new Metronome(sound);
		const thisRun = run;
		const started = performance.now();
		const hits = [];
		const listener = (e) => e.detail.on && hits.push({ midi: e.detail.midi, at: performance.now() });
		hub.addEventListener("note", listener, { signal });
		session = { tempo: true };
		running(true);
		keepAwake(true);
		const timers = [];
		const totalBeats = Math.ceil(times[times.length - 1] / spb) + 2;
		let t0 = null;
		if (falling) {
			falling.setSteps(list);
			// Before the count-in ends (t0 unknown) estimate from the start: four beats early.
			falling.play(() => list[0].beat + (t0 != null ? (performance.now() - t0) / spb : (performance.now() - started) / spb - 4));
		}
		metronome.start({
			bpm,
			beats: 4 + totalBeats,
			onBeat: ({ index, perfTime }) => {
				if (index !== 4) return;
				t0 = perfTime;
				list.forEach((_, i) => timers.push(setTimeout(() => showStep(list, i), Math.max(0, t0 + times[i] - performance.now()))));
				timers.push(setTimeout(() => playOther(full, hands, list[0].beat, null, spb), Math.max(0, t0 - performance.now())));
				timers.push(setTimeout(finish, Math.max(0, t0 + times[times.length - 1] + spb * 2 - performance.now())));
			},
		});
		function finish() {
			hub.removeEventListener("note", listener);
			metronome.stop();
			const expected = list.flatMap((s, i) => s.notes.map((n) => ({ at: t0 + times[i], midi: n.midi })));
			const judged = judgeTiming(expected, hits, { window: Math.max(80, spb * 0.15), reach: spb / 2 });
			const score = pieceScore({ mode: "tempo", notes: expected.length, wrong: judged.wrong, counts: judged.counts });
			const c = judged.counts;
			feedback.replaceChildren(
				el("p", { text: t("piece.summaryTempo", { onTime: c.onTime, early: c.early, late: c.late, missed: c.missed, wrong: judged.wrong, streak: judged.longestStreak }) }),
				el("p", { className: "ok", text: t("piece.score", { score }) }),
			);
			saveRun({ mode: "tempo", tempo: bpm, score, wrong: c.missed + judged.wrong });
			session = null;
			keyboard.clearMarks();
			lights.clear();
			falling?.stop();
			if (!loop.checked) {
				running(false);
				keepAwake(false);
			}
			// Loop: start the same bars again after a short pause, with a new count-in.
			if (loop.checked && run === thisRun) setTimeout(() => run === thisRun && startTempo(), 1500);
		}
		stopTempo = () => {
			for (const x of timers) clearTimeout(x);
			metronome.stop();
			hub.removeEventListener("note", listener);
		};
	}

	function listen() {
		stopAll();
		const [from, to] = range();
		const list = steps.filter((s) => s.bar >= from && s.bar <= to);
		const { spb, times } = timeline(list);
		const notes = [];
		const timers = [];
		list.forEach((s, i) => {
			const next = ((times[i + 1] ?? times[i] + spb) - times[i]) / 1000;
			for (const n of s.notes) notes.push({ midi: n.midi, at: times[i] / 1000, dur: Math.max(0.15, (n.dur ? (n.dur * spb) / 1000 : next) * 0.95) });
			timers.push(setTimeout(() => showStep(list, i), times[i]));
		});
		keepAwake(true);
		const stopSeq = sound.sequence(notes);
		if (falling) {
			const started = performance.now();
			falling.setSteps(list);
			falling.play(() => list[0].beat + (performance.now() - started) / spb);
			timers.push(setTimeout(() => falling?.stop(), times[times.length - 1] + spb * 2));
		}
		// When the playback ends by itself, nothing is running any more (control keys start again).
		timers.push(
			setTimeout(() => {
				stopListen = null;
				keepAwake(false);
			}, times[times.length - 1] + spb * 2),
		);
		stopListen = () => {
			stopSeq();
			for (const x of timers) clearTimeout(x);
		};
	}

	const begin = () => {
		stopAll();
		sound.unlock();
		if (value("mode") === "tempo") startTempo();
		else startWait();
	};
	startBtn.addEventListener("click", begin);
	listenBtn.addEventListener("click", () => {
		sound.unlock();
		listen();
	});
	stopBtn.addEventListener("click", stopAll);
	// Control keys on the instrument (Devices page): start or stop, and restart.
	hub.addEventListener(
		"control",
		(e) => {
			if (e.detail.action === "restart") begin();
			else if (session || stopListen) stopAll();
			else begin();
		},
		{ signal },
	);
	status.textContent = t("piece.progress", { i: 1, n: steps.length });
	return () => {
		stopAll();
		listeners.abort();
	};
}
