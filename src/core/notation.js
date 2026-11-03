// Compact text notation for built-in pieces and rhythm drills, and its conversion to
// staff items (own renderer) and MusicXML (OpenSheetMusicDisplay). Pure.
//
// Tokens are separated by spaces, bars by "|":
//   C4q   note C4, quarter        values: w whole, hd dotted half, h half, qd dotted quarter, q quarter, e eighth
//   F#5e  sharp, Bb4h flat        octave in scientific pitch (C4 = middle C)
//   C4+E4+G4h                     chord (all notes share the value)
//   rq rh rw re                   rests
// Example: "C4q C4q C4q E4q | D4q D4q D4q F4q | E4q E4q D4q D4q | C4w"

import { midiOf } from "./notes.js";

export const BEATS = { w: 4, hd: 3, h: 2, qd: 1.5, q: 1, e: 0.5 };
const DIVISIONS = 4; // MusicXML divisions per quarter note
const XML_TYPE = { w: "whole", hd: "half", h: "half", qd: "quarter", q: "quarter", e: "eighth" };
const NOTE_RE = /^([A-G])(#|b)?(\d)$/;

export class NotationError extends Error {}

function parsePitch(s) {
	const m = NOTE_RE.exec(s);
	if (!m) throw new NotationError(`bad pitch "${s}"`);
	return { step: m[1], alter: m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0, octave: Number(m[3]) };
}

/** Parse a melody string into items: { type: "note"|"rest"|"bar", notes?, value, beats }. */
export function parseMelody(str) {
	const items = [];
	for (const raw of str.trim().split(/\s+/)) {
		if (!raw) continue;
		if (raw === "|") {
			items.push({ type: "bar" });
			continue;
		}
		const m = /^(.*?)(w|hd|h|qd|q|e)$/.exec(raw);
		if (!m) throw new NotationError(`bad token "${raw}"`);
		const [, head, value] = m;
		if (head === "r") {
			items.push({ type: "rest", value, beats: BEATS[value] });
			continue;
		}
		const notes = head.split("+").map(parsePitch);
		items.push({ type: "note", notes, value, beats: BEATS[value] });
	}
	return items;
}

/** Split parsed items into bars (arrays of note/rest items). */
export function bars(items) {
	const out = [[]];
	for (const it of items) {
		if (it.type === "bar") out.push([]);
		else out[out.length - 1].push(it);
	}
	return out.filter((b) => b.length);
}

/** Check that every bar holds exactly `beatsPerBar` beats (pickup bar allowed to be shorter). */
export function checkBars(items, beatsPerBar, { pickup = false } = {}) {
	const problems = [];
	bars(items).forEach((bar, i) => {
		const sum = bar.reduce((a, it) => a + it.beats, 0);
		if (sum !== beatsPerBar && !(pickup && i === 0 && sum < beatsPerBar)) problems.push({ bar: i + 1, beats: sum });
	});
	return problems;
}

/** MIDI steps for wait mode from parsed items: [{ notes: [midi], beats, bar }]. */
export function melodySteps(items) {
	const steps = [];
	let bar = 1;
	for (const it of items) {
		if (it.type === "bar") bar++;
		else if (it.type === "note") steps.push({ notes: it.notes.map(midiOf), beats: it.beats, bar });
	}
	return steps;
}

/**
 * Steps for wait and tempo mode from a built-in piece: [{ notes: [{ midi, hand, dur }], bar,
 * beat, iter }], `dur` in beats. Bass notes (`left`) join the melody step that starts on the same
 * beat; the catalog rule (tested) is that every bass note starts together with a melody note,
 * so `iter` is also the index of the melody note in the score.
 */
export function pieceSteps(piece) {
	const steps = [];
	let beat = 0;
	let bar = 1;
	for (const it of parseMelody(piece.right)) {
		if (it.type === "bar") bar++;
		else {
			if (it.type === "note") steps.push({ notes: it.notes.map((n) => ({ midi: midiOf(n), hand: "right", dur: it.beats })), bar, beat, iter: steps.length });
			beat += it.beats;
		}
	}
	if (piece.left) {
		const at = new Map(steps.map((s) => [s.beat, s]));
		let b = 0;
		for (const it of parseMelody(piece.left)) {
			if (it.type === "bar") continue;
			if (it.type === "note") {
				const s = at.get(b);
				if (!s) throw new NotationError(`bass note at beat ${b} has no melody note`);
				s.notes.push(...it.notes.map((n) => ({ midi: midiOf(n), hand: "left", dur: it.beats })));
			}
			b += it.beats;
		}
	}
	return steps;
}

/**
 * Staff items for the own renderer; eighth pairs inside a beat get beams. `alters` is the key
 * signature ({ F: 1 }): notes that match it get no sign, notes that differ get one (natural too).
 */
export function toStaffItems(items, clef, alters = {}) {
	const out = [];
	let beat = 0;
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (it.type === "bar") {
			out.push({ type: "bar" });
			beat = 0;
			continue;
		}
		if (it.type === "rest") out.push({ type: "rest", value: it.value === "qd" ? "q" : it.value === "hd" ? "h" : it.value, clef });
		else {
			const next = items[i + 1];
			const item = { type: "note", notes: it.notes.map((n) => ({ ...n, clef, written: n.alter === (alters[n.step] ?? 0) ? null : n.alter })), value: it.value };
			if (it.value === "e" && Number.isInteger(beat) && next?.type === "note" && next.value === "e") item.beam = "begin";
			else if (it.value === "e" && !Number.isInteger(beat) && out[out.length - 1]?.beam === "begin") item.beam = "end";
			out.push(item);
		}
		beat += it.beats;
	}
	return out;
}

function xmlEscape(s) {
	return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function noteXml(it, voice, staff) {
	const dur = it.beats * DIVISIONS;
	const dot = it.value === "hd" || it.value === "qd" ? "<dot/>" : "";
	if (it.type === "rest") return `<note><rest/><duration>${dur}</duration><voice>${voice}</voice><type>${XML_TYPE[it.value]}</type>${dot}<staff>${staff}</staff></note>`;
	return it.notes
		.map(
			(n, idx) =>
				`<note>${idx ? "<chord/>" : ""}<pitch><step>${n.step}</step>${n.alter ? `<alter>${n.alter}</alter>` : ""}<octave>${n.octave}</octave></pitch><duration>${dur}</duration><voice>${voice}</voice><type>${XML_TYPE[it.value]}</type>${dot}<staff>${staff}</staff></note>`,
		)
		.join("");
}

/**
 * MusicXML 4.0 (partwise) for a piano piece.
 * piece = { title, composer, fifths, time: [beats, beatType], right: "melody", left?: "melody", pickup? }
 */
export function toMusicXml(piece) {
	const right = bars(parseMelody(piece.right));
	const left = piece.left ? bars(parseMelody(piece.left)) : null;
	const staves = left ? 2 : 1;
	const measures = [];
	for (let i = 0; i < right.length; i++) {
		let attrs = "";
		if (i === 0) {
			attrs = `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${piece.fifths ?? 0}</fifths></key><time><beats>${piece.time[0]}</beats><beat-type>${piece.time[1]}</beat-type></time>${
				staves === 2 ? "<staves>2</staves>" : ""
			}<clef number="1"><sign>G</sign><line>2</line></clef>${staves === 2 ? '<clef number="2"><sign>F</sign><line>4</line></clef>' : ""}</attributes>`;
		}
		let body = right[i].map((it) => noteXml(it, 1, 1)).join("");
		if (left && left[i]) {
			const rightDur = right[i].reduce((a, it) => a + it.beats * DIVISIONS, 0);
			body += `<backup><duration>${rightDur}</duration></backup>${left[i].map((it) => noteXml(it, 5, 2)).join("")}`;
		}
		const barline = i === right.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : "";
		// An upbeat (pickup) is measure 0 and "implicit": it does not count as a full bar.
		const number = piece.pickup ? i : i + 1;
		measures.push(`<measure number="${number}"${piece.pickup && i === 0 ? ' implicit="yes"' : ""}>${attrs}${body}${barline}</measure>`);
	}
	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${xmlEscape(piece.title)}</work-title></work><identification><creator type="composer">${xmlEscape(piece.composer)}</creator><rights>${xmlEscape(piece.rights ?? "")}</rights></identification><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${measures.join("")}</part></score-partwise>
`;
}

/**
 * Split a melody into systems (lines) of `barsPerLine` bars for the own renderer. With `left`
 * (a bass line) the items are for a grand staff: bass notes ride on the melody items.
 * Returns [{ items, firstStep }] where items are staff items with bar lines and firstStep is
 * the index (in melodySteps order) of the first note on that line.
 */
/**
 * Put the bass notes of one bar into the melody items that start on the same beat (two-staff
 * score). A bass note keeps its own value, so a whole note can sit under four quarters.
 */
function addBass(items, bar, bassBar, alters) {
	const at = new Map();
	let b = 0;
	for (const it of bassBar) {
		if (it.type === "note") at.set(b, it);
		b += it.beats;
	}
	let beat = 0;
	bar.forEach((it, idx) => {
		const bassNote = at.get(beat);
		if (it.type === "note" && bassNote)
			items[idx].notes.push(...bassNote.notes.map((n) => ({ ...n, clef: "bass", written: n.alter === (alters[n.step] ?? 0) ? null : n.alter, value: bassNote.value })));
		beat += it.beats;
	});
}

export function systems(melody, { clef = "treble", alters = {}, barsPerLine = 4, left = null } = {}) {
	const all = bars(parseMelody(melody));
	const bass = left ? bars(parseMelody(left)) : null;
	const out = [];
	let step = 0;
	for (let i = 0; i < all.length; i += barsPerLine) {
		const chunk = all.slice(i, i + barsPerLine);
		const items = [];
		chunk.forEach((bar, k) => {
			if (k) items.push({ type: "bar" });
			const barItems = toStaffItems(bar, clef, alters);
			if (bass) addBass(barItems, bar, bass[i + k] ?? [], alters);
			items.push(...barItems);
		});
		items.push({ type: i + barsPerLine >= all.length ? "final" : "bar" });
		out.push({ items, firstStep: step, firstBar: i + 1 });
		step += chunk.flat().filter((it) => it.type === "note").length;
	}
	return out;
}
