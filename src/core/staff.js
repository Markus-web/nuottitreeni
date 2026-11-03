// SVG staff renderer that returns a string, so the build can pre-render guide examples and
// the browser can draw drills with the same code. No DOM access.
//
// renderStaff({
//   staff: "treble" | "bass" | "grand",
//   keySig: { F: 1, C: 1, B: -1 } | null,
//   timeSig: [4, 4] | null,
//   items: [
//     { type: "note", notes: [{ step, alter, octave, clef, written }], value: "w"|"h"|"hd"|"q"|"qd"|"e",
//       label?, state?: "current"|"ok"|"bad"|"done", beam?: "begin"|"end" },
//     { type: "rest", value: "w"|"h"|"q"|"e", clef? },
//     { type: "bar" } | { type: "final" }
//   ],
//   label?: accessible name (role="img"); omit for aria-hidden decoration,
//   className?: extra CSS class
// })
//
// Glyphs come from the bundled Noto Music subset (font-family "NT Music"): clefs, accidentals,
// rests. Noteheads, stems, flags, beams and lines are plain SVG so they never depend on fonts.
import { BOTTOM_LINE } from "./explain.js";
import { diatonic } from "./notes.js";

const GAP = 12;
const HALF = GAP / 2;
const STAFF_SPAN = 4 * GAP;
const GRAND_GAP = 7 * GAP;
const TOP = 60;
const BOTTOM_PAD = 64;
const CLEF_W = 56;
const STEP_X = 44;
const ACC_STEP_X = 58;

const GLYPH = {
	treble: "\u{1D11E}",
	bass: "\u{1D122}",
	sharp: "♯",
	flat: "♭",
	natural: "♮",
	restW: "\u{1D13B}",
	restH: "\u{1D13C}",
	restQ: "\u{1D13D}",
	restE: "\u{1D13E}",
};
const ACC = { 1: GLYPH.sharp, "-1": GLYPH.flat, 0: GLYPH.natural };
const REST = { w: GLYPH.restW, h: GLYPH.restH, q: GLYPH.restQ, e: GLYPH.restE };
// Key-signature positions (diatonic) per clef, in conventional drawing order.
const SIG_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const SIG_FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const SIG_POS = {
	treble: { F: 38, C: 35, G: 39, D: 36, A: 33, E: 37, B: 34 },
	bass: { F: 24, C: 21, G: 25, D: 22, A: 19, E: 23, B: 20 },
};

export function escapeXml(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const f = (n) => (Math.round(n * 10) / 10).toString();

function line(x1, y1, x2, y2, cls) {
	return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="${cls}"/>`;
}

function text(x, y, content, cls, extra = "") {
	return `<text x="${f(x)}" y="${f(y)}" class="${cls}"${extra}>${escapeXml(content)}</text>`;
}

function itemWidth(item) {
	if (item.type === "bar" || item.type === "final") return 18;
	if (item.type === "rest") return STEP_X;
	const accidental = item.notes.some((n) => n.written != null);
	const dotted = item.value === "hd" || item.value === "qd";
	return (accidental ? ACC_STEP_X : STEP_X) + (dotted ? 10 : 0);
}

export function renderStaff(opts) {
	const { staff, keySig = null, timeSig = null, items = [], label = null, className = "", scale = null } = opts;
	const clefs = staff === "grand" ? ["treble", "bass"] : [staff];
	const bottomY = {};
	clefs.forEach((clef, i) => {
		bottomY[clef] = TOP + STAFF_SPAN + i * (STAFF_SPAN + GRAND_GAP);
	});
	const yOf = (clef, pos) => bottomY[clef] - (pos - BOTTOM_LINE[clef]) * HALF;

	// Horizontal layout.
	let x = CLEF_W + 8;
	const sigSteps = keySig ? Object.keys(keySig).filter((s) => keySig[s]) : [];
	const sigX = x;
	x += sigSteps.length * 13 + (sigSteps.length ? 8 : 0);
	const timeX = x;
	if (timeSig) x += 30;
	x += 22;
	const xs = items.map((item) => {
		const w = itemWidth(item);
		const cx = x + (item.type === "note" && item.notes.some((n) => n.written != null) ? 14 : 0);
		x += w;
		return cx;
	});
	const width = Math.max(320, x + 16);
	const lastClef = clefs[clefs.length - 1];
	const height = bottomY[lastClef] + BOTTOM_PAD;

	const out = [];
	// Staff lines, clefs, signatures.
	for (const clef of clefs) {
		const y0 = bottomY[clef] - STAFF_SPAN;
		for (let l = 0; l < 5; l++) out.push(line(8, y0 + l * GAP, width - 8, y0 + l * GAP, "st-line"));
		out.push(
			clef === "treble"
				? text(12, y0 + 3 * GAP + 4, GLYPH.treble, "st-clef st-clef-treble")
				: text(14, y0 + GAP + 1, GLYPH.bass, "st-clef st-clef-bass"),
		);
		const order = sigSteps.length && keySig[sigSteps[0]] === -1 ? SIG_FLAT_ORDER : SIG_ORDER;
		let sx = sigX;
		for (const step of order) {
			if (!keySig?.[step]) continue;
			out.push(text(sx, yOf(clef, SIG_POS[clef][step]) + 9, ACC[keySig[step]], "st-acc st-sig"));
			sx += 13;
		}
		if (timeSig) {
			out.push(text(timeX + 10, y0 + 2 * GAP - 2, String(timeSig[0]), "st-time", ' text-anchor="middle"'));
			out.push(text(timeX + 10, y0 + 4 * GAP - 2, String(timeSig[1]), "st-time", ' text-anchor="middle"'));
		}
	}
	const top = bottomY[clefs[0]] - STAFF_SPAN;
	const bottom = bottomY[lastClef];
	if (staff === "grand") out.push(line(8, top, 8, bottom, "st-line"));
	out.push(line(width - 8, top, width - 8, bottom, "st-line"));

	// Stem geometry per note item, used by beams.
	const stems = [];
	items.forEach((item, i) => {
		const cx = xs[i];
		if (item.type === "bar") {
			out.push(line(cx, top, cx, bottom, "st-line st-bar"));
			return;
		}
		if (item.type === "final") {
			out.push(line(cx - 4, top, cx - 4, bottom, "st-line st-bar"));
			out.push(`<rect x="${f(cx - 1)}" y="${f(top)}" width="4" height="${f(bottom - top)}" class="st-fill"/>`);
			return;
		}
		if (item.type === "rest") {
			const clef = item.clef || clefs[0];
			const y0 = bottomY[clef] - STAFF_SPAN;
			const ry = item.value === "w" ? y0 + GAP + 1 : item.value === "h" ? y0 + 2 * GAP - 1 : y0 + 2 * GAP + 9;
			out.push(`<g class="st-item${item.state ? ` is-${item.state}` : ""}">${text(cx - 7, ry, REST[item.value] || GLYPH.restQ, "st-rest")}</g>`);
			return;
		}
		stems.push(renderNote(out, item, cx, yOf, bottomY));
	});

	// Beams between "begin" and "end" eighths (stems already point the same way).
	for (let i = 0; i < stems.length; i++) {
		const s = stems[i];
		if (!s || s.beam !== "begin") continue;
		const e = stems.slice(i + 1).find((t) => t && t.beam === "end");
		if (!e) continue;
		const y = s.up ? Math.min(s.tipY, e.tipY) : Math.max(s.tipY, e.tipY);
		out.push(`<polygon points="${f(s.x)},${f(y)} ${f(e.x)},${f(y)} ${f(e.x)},${f(y + (s.up ? 5 : -5))} ${f(s.x)},${f(y + (s.up ? 5 : -5))}" class="st-fill"/>`);
		for (const t of [s, e]) out.push(line(t.x, t.headY, t.x, y, "st-stem"));
	}

	const a11y = label ? ` role="img" aria-label="${escapeXml(label)}"` : ' aria-hidden="true" focusable="false"';
	// scale: fixed pixel size (used for examples inside a scrolling figure, so labels stay >= 12px).
	const size = scale ? ` width="${f(width * scale)}" height="${f(height * scale)}"` : "";
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(width)} ${f(height)}"${size} class="staff${className ? ` ${className}` : ""}"${a11y}>${out.join("")}</svg>`;
}

function renderNote(out, item, cx, yOf, bottomY) {
	const notes = item.notes;
	const state = item.state ? ` is-${item.state}` : "";
	const parts = [];
	const ys = [];
	for (const n of notes) {
		const clef = n.clef;
		const base = BOTTOM_LINE[clef];
		const d = diatonic(n);
		for (let p = base - 2; p >= d; p -= 2) parts.push(line(cx - 14, yOf(clef, p), cx + 14, yOf(clef, p), "st-line st-ledger"));
		for (let p = base + 10; p <= d; p += 2) parts.push(line(cx - 14, yOf(clef, p), cx + 14, yOf(clef, p), "st-line st-ledger"));
		ys.push({ y: yOf(clef, d), d, clef, n });
	}
	const clef0 = notes[0].clef;
	const open = item.value === "w" || item.value === "h" || item.value === "hd";
	// One stem per staff: a chord spanning both staffs of a grand staff gets two stems.
	const groups = [...new Set(ys.map((v) => v.clef))].map((clef) => ys.filter((v) => v.clef === clef));
	let stem = null;
	let up = true;
	for (const group of groups) {
		const avg = group.reduce((a, v) => a + (v.d - BOTTOM_LINE[v.clef]), 0) / group.length;
		up = avg < 4;
		const sorted = [...group].sort((a, b) => a.y - b.y);
		sorted.forEach((v, idx) => {
			// Seconds in a chord: shift one head of a close pair to the other side of the stem.
			const prev = sorted[idx - 1];
			const shift = prev && Math.abs(prev.d - v.d) === 1 ? (up ? 15 : -15) : 0;
			const hx = cx + shift;
			parts.push(`<ellipse cx="${f(hx)}" cy="${f(v.y)}" rx="7.6" ry="5.4" transform="rotate(-20 ${f(hx)} ${f(v.y)})" class="${open ? "st-head st-open" : "st-head"}"/>`);
			if (v.n.written != null) parts.push(text(cx - 30, v.y + 9, ACC[v.n.written], "st-acc"));
			if (item.value === "hd" || item.value === "qd") {
				const onLine = (v.d - BOTTOM_LINE[v.clef]) % 2 === 0;
				parts.push(`<circle cx="${f(cx + 14)}" cy="${f(v.y - (onLine ? HALF : 0))}" r="2.2" class="st-fill"/>`);
			}
		});
		if (item.value === "w") continue;
		const headY = up ? sorted[sorted.length - 1].y : sorted[0].y;
		const farY = up ? sorted[0].y : sorted[sorted.length - 1].y;
		const sx = up ? cx + 7 : cx - 7;
		const tipY = up ? farY - 3.5 * GAP : farY + 3.5 * GAP;
		if (item.beam && groups.length === 1) {
			stem = { x: sx, headY, tipY, up, beam: item.beam };
		} else {
			parts.push(line(sx, headY, sx, tipY, "st-stem"));
			if (item.value === "e") {
				const dir = up ? 1 : -1;
				parts.push(`<path d="M${f(sx)} ${f(tipY)} c 2 ${f(dir * 8)} 12 ${f(dir * 10)} 8 ${f(dir * 22)}" class="st-flag"/>`);
			}
		}
	}
	if (item.label) {
		const lowest = Math.max(...ys.map((v) => v.y));
		const ly = Math.max(bottomY[ys[ys.length - 1].clef] + 30, lowest + (up ? 22 : 3.5 * GAP + 16));
		parts.push(text(cx, ly, item.label, "st-label", ' text-anchor="middle"'));
	}
	if (item.state === "current") {
		const topY = bottomY[clef0] - STAFF_SPAN - 26;
		const highest = Math.min(...ys.map((v) => v.y)) - (up ? 3.5 * GAP + 10 : 14);
		const my = Math.min(topY, highest);
		parts.push(`<path d="M${f(cx - 7)} ${f(my - 8)} L${f(cx + 7)} ${f(my - 8)} L${f(cx)} ${f(my)} Z" class="st-marker"/>`);
	}
	const data = item.midi != null ? ` data-midi="${item.midi}"` : "";
	out.push(`<g class="st-item${state}"${data}>${parts.join("")}</g>`);
	return stem;
}
