// Note explorer: play any key (instrument, screen keys, computer keyboard or microphone) and see
// the note on a grand staff with its name, how to read it (src/core/worked-example.js), and for
// two or more notes the interval or chord (src/core/chords.js). Reading in reverse: from the
// key to the staff. Nothing is scored or saved.
import { nameChord, nameInterval } from "../core/chords.js";
import { PianoKeyboard } from "../core/keyboard.js";
import { midiLabel, noteName, spellMidi } from "../core/notes.js";
import { describeNote } from "../core/notes.js";
import { renderStaff } from "../core/staff.js";
import { getSettings, saveSettings } from "../core/store.js";
import { explainText } from "../core/worked-example.js";
import { $, boot, el, howTo } from "./common.js";

const ctx = await boot();
const { t, dict, hub, noteNames } = ctx;
const root = $("#app-root");
const HISTORY = 8;

const prefer = el("select", { id: "explore-spelling" });
for (const v of ["sharp", "flat"]) prefer.append(el("option", { value: v, text: t(`explore.spelling.${v}`) }));
prefer.value = getSettings().exploreSpelling === "flat" ? "flat" : "sharp";
prefer.addEventListener("change", () => {
	saveSettings({ exploreSpelling: prefer.value });
	render();
});
const figure = el("figure", { className: "figure", tabindex: "0" });
const names = el("p", { className: "explore-names", role: "status" });
const reading = el("p", {});
const chordLine = el("p", {});
const recent = el("ol", { className: "results", "aria-label": t("explore.recent") });
const kbdBox = el("div");
root.append(
	howTo(ctx, "explore", dict.howto.explore),
	el("div", { className: "field" }, el("label", { for: "explore-spelling", text: t("explore.spellingLabel") }), prefer),
	figure,
	names,
	reading,
	chordLine,
	kbdBox,
	el("h2", { text: t("explore.recent") }),
	recent,
);
const keyboard = new PianoKeyboard(kbdBox, { t, noteNames, low: 36, high: 95, id: "explore-kbd" });
keyboard.addEventListener("key", (e) => hub.screen(e.detail.midi, e.detail.on));

const held = new Set();
const label = (n) => `${noteName(n.step, n.alter, noteNames)}${n.octave}`;

function render() {
	const midis = [...held].sort((a, b) => a - b);
	const notes = midis.map((m) => describeNote(m, prefer.value));
	figure.innerHTML = renderStaff({ staff: "grand", items: notes.length ? [{ type: "note", value: "q", notes }] : [], label: notes.length ? notes.map(label).join(", ") : t("explore.empty") });
	if (!midis.length) {
		names.textContent = t("explore.empty");
		reading.textContent = "";
		chordLine.textContent = "";
		return;
	}
	// Black keys get both names (C sharp and D flat are the same key).
	names.textContent = midis
		.map((m) => {
			const s = spellMidi(m, "sharp");
			const f = spellMidi(m, "flat");
			const both = s.step !== f.step ? ` / ${noteName(f.step, f.alter, noteNames)}${f.octave}` : "";
			return `${noteName(s.step, s.alter, noteNames)}${s.octave}${both}`;
		})
		.join(", ");
	reading.textContent = midis.length === 1 ? explainText(notes[0], t, noteNames) : "";
	chordLine.textContent = describeSet(midis);
}

function describeSet(midis) {
	if (midis.length === 2) {
		const iv = nameInterval(midis[0], midis[1]);
		const name = iv.key === "octave" && iv.octaves ? t("chords.octaves", { n: iv.octaves + 1 }) : t(`chords.intervals.${iv.key}`);
		return t("chords.interval", { name: iv.octaves && iv.key !== "octave" ? t("chords.compound", { name }) : name });
	}
	if (midis.length < 3) return "";
	const chord = nameChord(midis);
	if (!chord) return t("chords.unknown");
	const r = spellMidi(chord.root + 60, prefer.value);
	const root = noteName(r.step, r.alter, noteNames);
	const name = t(`chords.quality.${chord.quality}`, { root, rootLower: root.toLowerCase() });
	return t("chords.chord", { name, inversion: dict.chords.inversions[chord.inversion] });
}

hub.addEventListener("note", (e) => {
	const { midi, on } = e.detail;
	keyboard.setOn(midi, on);
	if (on) {
		held.add(midi);
		recent.prepend(el("li", { text: midiLabel(midi, noteNames) }));
		while (recent.children.length > HISTORY) recent.lastChild.remove();
	} else held.delete(midi);
	render();
});
render();
