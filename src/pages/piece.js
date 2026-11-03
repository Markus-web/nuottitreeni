// Piece practice.
//   Built-in pieces (/kappaleet/<slug>/): engraved at build time with the own renderer (fast,
//   no 1.4 MB engine); the page re-renders the systems to mark the current note.
//   Imported MusicXML/MXL (/oma-kappale/?id=): OpenSheetMusicDisplay, loaded only here.
//   Imported MIDI: own grand-staff view of the next steps.
// Wait mode (default, untimed): a step advances when all its notes are played, any order.
// Tempo mode (optional): metronome with count-in; each note is judged against its beat.
// View options (saved in settings): note names and suggested fingering on built-in scores,
// falling notes above the keyboard, marks on the next keys; the score can be printed.
import { PIECES, altersFor } from "../content/catalog.js";
import { FallingNotes } from "../core/falling.js";
import { suggestFingers } from "../core/fingering.js";
import { PianoKeyboard } from "../core/keyboard.js";
import { melodySteps, parseMelody, systems } from "../core/notation.js";
import { midiLabel, noteName, spellMidi } from "../core/notes.js";
import { recordPiece } from "../core/progress.js";
import { cursorTo, createScore, extractSteps, loadScore, recolor, toBinaryString } from "../core/score.js";
import { parseSmf, toSteps } from "../core/smf.js";
import { Metronome } from "../core/sound.js";
import { renderStaff } from "../core/staff.js";
import { getDeviceId, getProgress, getSettings, idb, saveProgress, saveSettings } from "../core/store.js";
import * as icons from "../content/icons.js";
import { $, boot, el } from "./common.js";

const ctx = await boot();
const { t, hub, sound, noteNames, cfg } = ctx;
const root = $("#app-root");
const builtIn = cfg.data?.piece ? PIECES.find((p) => p.id === cfg.data.piece) : null;

/** Engine for the page: built-in (own renderer), OSMD (MusicXML/MXL) or MIDI (own grand staff). */
async function loadEngine() {
	if (builtIn) {
		const alters = altersFor(builtIn.fifths);
		let beat = 0;
		const steps = melodySteps(parseMelody(builtIn.right)).map((s, i) => {
			const step = { notes: s.notes.map((midi) => ({ midi, hand: "right" })), bar: s.bar, beat, iter: i };
			beat += s.beats;
			return step;
		});
		const box = $("#score");
		const lines = systems(builtIn.right, { alters });
		const title = ctx.dict.piecesMeta[builtIn.id].title;
		const melody = parseMelody(builtIn.right).filter((it) => it.type === "note");
		const fingers = suggestFingers(melody.map((it) => it.notes[it.notes.length - 1]));
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
							label: scoreNames ? it.notes.map((n) => noteName(n.step, n.alter, noteNames)).join("+") : undefined,
							finger: scoreFingers ? fingers[i] : undefined,
						};
					});
					return renderStaff({
						staff: "treble",
						keySig: Object.keys(alters).length ? alters : null,
						timeSig: li === 0 ? builtIn.time : null,
						items,
						label: `${title}, ${t("piece.bar", { n: sys.firstBar })}`,
						scale: 1,
						className: "staff-system",
					});
				})
				.join("");
			box.querySelector(".is-current")?.scrollIntoView({ block: "nearest", inline: "center" });
		};
		return { steps, show, redraw: () => show(last) };
	}
	const id = new URLSearchParams(location.search).get("id");
	const rec = id ? await idb.get("pieces", id).catch(() => null) : null;
	if (!rec) return null;
	$("#page-title").textContent = rec.name;
	document.title = `${rec.name}, ${t("site.name")}`;
	const box = el("div", { id: "score", className: "score" });
	root.append(el("figure", { className: "figure", tabindex: "0" }, box, el("figcaption", { text: rec.name })));
	if (rec.kind === "midi") {
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
		return { steps, show };
	}
	box.textContent = t("piece.loadingScore");
	const osmd = await createScore(box, cfg.osmd);
	box.textContent = "";
	await loadScore(osmd, rec.kind === "mxl" ? toBinaryString(rec.data) : rec.data);
	addEventListener("nt-theme", () => recolor(osmd));
	const steps = extractSteps(osmd);
	return { steps, show: (current) => steps[current] && cursorTo(osmd, steps[current].iter) };
}

let engine = null;
try {
	engine = await loadEngine();
} catch {
	engine = null;
}
if (!engine || !engine.steps.length) {
	root.append(el("p", { className: "notice", text: builtIn ? t("piece.scoreFailed") : t("pieces.importFailed") }), el("p", {}, el("a", { className: "standalone", href: ctx.paths.pieces, text: t("pieces.title") })));
} else setup(engine);

function setup({ steps, show, redraw }) {
	const status = el("p", { className: "count" });
	const feedback = el("div", { className: "feedback", "aria-live": "polite" });
	if (!builtIn) {
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
	const modeSet = el("fieldset", {}, el("legend", { text: t("piece.mode") }), radio("mode", "wait", t("piece.modeWait"), true), radio("mode", "tempo", t("piece.modeTempo"), false));
	const handSet = hasLeft
		? el("fieldset", {}, el("legend", { text: t("piece.hands") }), radio("hands", "both", t("piece.both"), true), radio("hands", "right", t("piece.right"), false), radio("hands", "left", t("piece.left"), false))
		: null;
	const fromInput = el("input", { type: "number", id: "from-bar", min: "1", max: String(maxBar), value: "1" });
	const toInput = el("input", { type: "number", id: "to-bar", min: "1", max: String(maxBar), value: String(maxBar) });
	const loop = el("input", { type: "checkbox" });
	const tempo = el("input", { type: "range", id: "piece-tempo", min: "40", max: "160", step: "5", value: "80" });
	const tempoOut = el("output", { for: "piece-tempo", text: "80" });
	tempo.addEventListener("input", () => (tempoOut.textContent = tempo.value));
	const startBtn = el("button", { type: "button", className: "btn btn-primary", icon: icons.play, text: t("piece.practice") });
	const listenBtn = el("button", { type: "button", className: "btn", icon: icons.speakerHigh, text: t("piece.listen") });
	const stopBtn = el("button", { type: "button", className: "btn", icon: icons.stop, text: t("piece.stop") });
	const printBtn = el("button", { type: "button", className: "btn", icon: icons.printer, text: t("piece.print") });
	printBtn.addEventListener("click", () => window.print());
	const option = (key, label, onChange) => {
		const input = el("input", { type: "checkbox" });
		input.checked = getSettings()[key];
		input.addEventListener("change", () => {
			saveSettings({ [key]: input.checked });
			onChange(input.checked);
		});
		return el("label", { className: "check" }, input, label);
	};
	const viewSet = el(
		"fieldset",
		{},
		el("legend", { text: t("piece.viewHeading") }),
		redraw ? option("scoreNames", t("piece.showNames"), () => redraw()) : null,
		redraw ? option("scoreFingers", t("piece.showFingers"), () => redraw()) : null,
		option("nextNotes", t("piece.nextNotes"), (on) => !on && keyboard.clearMarks()),
		option("fallingNotes", t("piece.falling"), (on) => setFalling(on)),
	);
	const kbdBox = el("div");
	root.append(
		...[el("h2", { id: "practice-h", text: t("piece.practice") }), modeSet, handSet].filter(Boolean),
		el("div", { className: "field" }, el("label", { for: "from-bar", text: t("piece.fromBar") }), fromInput),
		el("div", { className: "field" }, el("label", { for: "to-bar", text: t("piece.toBar") }), toInput),
		el("label", { className: "check" }, loop, t("piece.loop")),
		el("div", { className: "field" }, el("label", { for: "piece-tempo", text: t("piece.tempo") }), tempo, " ", tempoOut),
		el("div", { className: "actions" }, startBtn, listenBtn, stopBtn, printBtn),
		viewSet,
		status,
		feedback,
		kbdBox,
	);
	const keyboard = new PianoKeyboard(kbdBox, { t, noteNames, low, high, id: "piece-kbd" });
	keyboard.addEventListener("key", (e) => hub.screen(e.detail.midi, e.detail.on));

	// Falling notes: off by default; moves only while a tempo run or Listen plays.
	let falling = null;
	function setFalling(on) {
		if (on && !falling) {
			falling = new FallingNotes(keyboard);
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

	const value = (name) => root.querySelector(`input[name="${name}"]:checked`)?.value ?? "both";
	function activeSteps() {
		const from = Math.max(1, Math.min(maxBar, Number(fromInput.value) || 1));
		const to = Math.max(from, Math.min(maxBar, Number(toInput.value) || maxBar));
		const hands = value("hands");
		return steps
			.filter((s) => s.bar >= from && s.bar <= to)
			.map((s) => ({ ...s, notes: s.notes.filter((n) => hands === "both" || n.hand === hands) }))
			.filter((s) => s.notes.length);
	}

	function showStep(list, i) {
		keyboard.clearMarks();
		const step = list[i];
		if (!step) return;
		if (getSettings().nextNotes) for (const n of step.notes) keyboard.mark(n.midi, "target");
		keyboard.scrollTo(step.notes[0].midi);
		if (falling && !falling.raf) falling.draw(step.beat);
		status.textContent = t("piece.progress", { i: i + 1, n: list.length });
		show(step.iter);
	}

	let session = null;
	let stopTempo = null;
	let stopListen = null;
	let run = 0; // increases on every stop, so a pending loop restart knows it was cancelled
	function stopAll() {
		run++;
		falling?.stop();
		session = null;
		stopTempo?.();
		stopTempo = null;
		stopListen?.();
		stopListen = null;
		keyboard.clearMarks();
	}

	function startWait() {
		const list = activeSteps();
		session = { list, i: 0, pressed: new Set(), wrong: 0 };
		falling?.setSteps(list);
		feedback.replaceChildren();
		showStep(list, 0);
		keyboard.setFocus(list[0].notes[0].midi, true);
	}

	hub.addEventListener("note", (e) => {
		keyboard.setOn(e.detail.midi, e.detail.on);
		if (!e.detail.on || !session || session.tempo) return;
		const step = session.list[session.i];
		if (!step) return;
		const midi = e.detail.midi;
		if (step.notes.some((n) => n.midi === midi)) {
			session.pressed.add(midi);
			if (step.notes.every((n) => session.pressed.has(n.midi))) {
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
	});

	function finishWait() {
		const wrong = session.wrong;
		feedback.replaceChildren(el("p", { className: "ok", text: t("piece.done", { wrong }) }));
		keyboard.clearMarks();
		show(-1);
		if (builtIn) saveProgress(recordPiece(getProgress(), getDeviceId(), { id: builtIn.id, wrong }, Date.now()));
		if (loop.checked) setTimeout(startWait, 1200);
		else session = null;
	}

	function timeline(list) {
		const bpm = Number(tempo.value);
		const spb = 60000 / bpm;
		const first = list[0].beat;
		return { spb, times: list.map((s) => (s.beat - first) * spb), bpm };
	}

	function startTempo() {
		const list = activeSteps();
		const { spb, times, bpm } = timeline(list);
		const metronome = new Metronome(sound);
		const thisRun = run;
		const started = performance.now();
		const hits = [];
		const listener = (e) => e.detail.on && hits.push({ midi: e.detail.midi, at: performance.now() });
		hub.addEventListener("note", listener);
		session = { tempo: true };
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
				timers.push(setTimeout(finish, Math.max(0, t0 + times[times.length - 1] + spb * 2 - performance.now())));
			},
		});
		const window = Math.max(80, spb * 0.15);
		function finish() {
			hub.removeEventListener("note", listener);
			metronome.stop();
			let ok = 0;
			let total = 0;
			const used = new Set();
			list.forEach((s, i) => {
				for (const n of s.notes) {
					total++;
					const at = t0 + times[i];
					const j = hits.findIndex((h, k) => !used.has(k) && h.midi === n.midi && Math.abs(h.at - at) <= window);
					if (j >= 0) {
						used.add(j);
						ok++;
					}
				}
			});
			const wrong = hits.length - used.size;
			feedback.replaceChildren(el("p", { text: `${t("rhythmUi.score", { ok, n: total })}. ${t("piece.done", { wrong })}` }));
			if (builtIn) saveProgress(recordPiece(getProgress(), getDeviceId(), { id: builtIn.id, wrong: total - ok + wrong }, Date.now()));
			session = null;
			keyboard.clearMarks();
			falling?.stop();
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
		const list = steps.filter((s) => s.bar >= (Number(fromInput.value) || 1) && s.bar <= (Number(toInput.value) || maxBar));
		const { spb, times } = timeline(list);
		const notes = [];
		const timers = [];
		list.forEach((s, i) => {
			const dur = ((times[i + 1] ?? times[i] + spb) - times[i]) / 1000;
			for (const n of s.notes) notes.push({ midi: n.midi, at: times[i] / 1000, dur: Math.max(0.15, dur * 0.95) });
			timers.push(setTimeout(() => showStep(list, i), times[i]));
		});
		const stopSeq = sound.sequence(notes);
		if (falling) {
			const started = performance.now();
			falling.setSteps(list);
			falling.play(() => list[0].beat + (performance.now() - started) / spb);
			timers.push(setTimeout(() => falling?.stop(), times[times.length - 1] + spb * 2));
		}
		stopListen = () => {
			stopSeq();
			for (const x of timers) clearTimeout(x);
		};
	}

	startBtn.addEventListener("click", () => {
		stopAll();
		sound.unlock();
		if (value("mode") === "tempo") startTempo();
		else startWait();
	});
	listenBtn.addEventListener("click", () => {
		sound.unlock();
		listen();
	});
	stopBtn.addEventListener("click", stopAll);
	status.textContent = t("piece.progress", { i: 1, n: steps.length });
}
