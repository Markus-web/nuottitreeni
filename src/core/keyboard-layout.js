// Piano keyboard geometry and a static (non-interactive) HTML rendering for guide pages.
// The interactive keyboard (src/core/keyboard.js) uses the same layout and CSS classes.
// Black keys are positioned with classes pos-1..pos-60 (defined in main.css) because the
// Content-Security-Policy blocks inline style attributes in HTML.
import { MIDDLE_C, isBlackKey, noteName, parseNoteKey, midiOf, spellMidi } from "./notes.js";
import { escapeXml } from "./staff.js";

export const MAX_WHITE_KEYS = 60;

/** Range rounded to whole octaves: from the C at or below `low` to the B at or above `high`. */
export function octaveRange(lowKey, highKey) {
	const low = midiOf(parseNoteKey(lowKey));
	const high = midiOf(parseNoteKey(highKey));
	return { low: low - (low % 12), high: high + (11 - (high % 12)) };
}

/** Keys for a range: [{ midi, black, white index of the key (for black: index of the white key to its right) }]. */
export function layoutKeys(low, high) {
	const keys = [];
	let white = 0;
	for (let m = low; m <= high; m++) {
		if (isBlackKey(m)) keys.push({ midi: m, black: true, pos: white });
		else keys.push({ midi: m, black: false, pos: white++ });
	}
	return { keys, whiteCount: white };
}

/** Name shown on a white key in the locale's naming system. */
export function whiteKeyName(midi, noteNames) {
	const n = spellMidi(midi);
	return noteName(n.step, n.alter, noteNames);
}

/**
 * Static keyboard HTML (aria-hidden; the surrounding figure has a caption).
 * highlight: pitch classes marked with ✓ (e.g. [0, 5] for every C and F).
 */
export function renderStaticKeyboard({ low, high, highlight = [], noteNames, showNames = true }) {
	const { keys } = layoutKeys(low, high);
	const parts = keys.map((k) => {
		const marked = highlight.includes(k.midi % 12);
		const cls = ["key", k.black ? "key-black" : "key-white", k.black ? `pos-${k.pos}` : "", marked ? "is-target" : ""].filter(Boolean).join(" ");
		const mark = marked ? '<span class="key-mark">✓</span>' : "";
		const name = !k.black && showNames ? `<span class="key-name">${escapeXml(whiteKeyName(k.midi, noteNames))}</span>` : "";
		const c4 = k.midi === MIDDLE_C ? '<span class="key-c4"></span>' : "";
		return `<span class="${cls}">${mark}${name}${c4}</span>`;
	});
	return `<div class="kbd-scroll"><div class="kbd" aria-hidden="true">${parts.join("")}</div></div>`;
}
