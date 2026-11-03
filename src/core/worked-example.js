// Worked example for one note: the note on the staff, how to read it (the sentences from
// explain.js, so every fact is one the tests check), and the key marked on one octave of the
// keyboard. Pure and returns HTML, so the build (lesson guides) and the practice pages share it.
// The figures are focusable (tabindex 0) because they scroll sideways on a narrow screen.
import { explainParts } from "./explain.js";
import { renderStaticKeyboard } from "./keyboard-layout.js";
import { midiOf, noteName } from "./notes.js";
import { escapeXml as esc, renderStaff } from "./staff.js";

/** The explanation sentences for a note, joined (also used after a miss in the drill). */
export function explainText(note, t, noteNames) {
	return explainSentences(note, t, noteNames).join(" ");
}

function explainSentences(note, t, noteNames) {
	return explainParts(note).map((p) => t(p.key, { ...p.vars, name: p.vars.step ? noteName(p.vars.step, p.vars.alter ?? 0, noteNames) : "" }));
}

/**
 * HTML for the worked example. note: { step, alter, octave, clef, written }.
 * keySig: key signature alters drawn on the staff (or null). verb: "play" or "choose" (name mode).
 */
export function workedExample(note, { t, noteNames, keySig = null, verb = "play" }) {
	const name = noteName(note.step, note.alter, noteNames);
	const steps = [...explainSentences(note, t, noteNames), t(verb === "choose" ? "howto.choose" : "howto.play", { name })];
	const midi = midiOf(note);
	const low = midi - (midi % 12);
	const staff = renderStaff({ staff: note.clef, keySig, items: [{ type: "note", value: "q", notes: [note] }], label: t("howto.staffLabel", { name }), scale: 1.15 });
	const keys = renderStaticKeyboard({ low, high: low + 11, highlight: [midi % 12], noteNames });
	return `<div class="worked">
<figure class="figure" tabindex="0">${staff}</figure>
<ol class="worked-steps">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
<figure class="figure" tabindex="0">${keys}<figcaption>${esc(t("howto.keysCaption", { name }))}</figcaption></figure>
</div>`;
}
