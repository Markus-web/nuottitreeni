// Falling notes above the on-screen keyboard (a piano-roll view as in Midiano): coming notes
// are bars that fall onto their keys; the bottom edge is "now". The canvas sits in the
// keyboard's own scroller (PianoKeyboard.setLane), so it lines up with the keys at any scroll
// position and in both themes (colours come from the CSS tokens).
//
// Accessibility: decorative and aria-hidden; the score, the key marks and the status line
// carry the same information. It is off by default, moves only while a tempo run or Listen
// plays (stopped with the Stop button, WCAG 2.2.2) and otherwise redraws once per step.
import { inkOn } from "./color.js";
import { noteName, spellMidi } from "./notes.js";

export class FallingNotes {
	/** keyboard: PianoKeyboard; beats: how many beats are visible above the keys. */
	constructor(keyboard, { beats = 4, height = 160 } = {}) {
		this.keyboard = keyboard;
		this.beats = beats;
		this.height = height;
		this.steps = [];
		this.labels = "none";
		this.raf = 0;
		this.canvas = document.createElement("canvas");
		this.canvas.className = "falling";
		this.canvas.setAttribute("aria-hidden", "true");
		keyboard.setLane(this.canvas);
	}

	/**
	 * steps: [{ notes: [{ midi, hand?, finger?, dur? }], beat }] in order. A bar lasts its note's
	 * `dur` (beats) when known, otherwise until the next step.
	 */
	setSteps(steps) {
		this.steps = steps.map((s, i) => {
			const dur = Math.max(0.25, (steps[i + 1]?.beat ?? s.beat + 1) - s.beat);
			return { notes: s.notes, beat: s.beat, dur, span: Math.max(dur, ...s.notes.map((n) => n.dur ?? 0)) };
		});
	}

	/** Labels inside the bars: "none", "names" or "fingers". */
	setLabels(mode) {
		this.labels = mode;
	}

	colors() {
		const cs = getComputedStyle(document.documentElement);
		const v = (name) => cs.getPropertyValue(name).trim();
		const mode = document.documentElement.getAttribute("data-note-colors");
		// White-key notes take their letter's colour in "names"; black keys keep --link there.
		const names = [..."c d ef g a b"].map((s) => (s === " " ? null : v(`--n-${s}`)));
		const fingers = [1, 2, 3, 4, 5].map((n) => v(`--f-${n}`));
		const hands = { right: v("--hand-right"), left: v("--hand-left") };
		const twoHands = this.steps.some((s) => s.notes.some((n) => n.hand === "left"));
		const colorOf = (n) =>
			mode === "names"
				? names[n.midi % 12]
				: mode === "fingers" && n.finger
					? fingers[n.finger - 1]
					: (mode === "hands" || (!mode && twoHands)) && n.hand
						? hands[n.hand]
						: null;
		return { bg: v("--surface"), bar: v("--link"), edge: v("--text"), line: v("--rule"), colorOf };
	}

	label(n) {
		if (this.labels === "fingers") return n.finger ? String(n.finger) : "";
		if (this.labels !== "names") return "";
		const s = spellMidi(n.midi);
		return noteName(s.step, s.alter, this.keyboard.noteNames);
	}

	/** Draw the view with `beat` at the bottom edge. */
	draw(beat) {
		this.lastBeat = beat;
		const kbd = this.keyboard.kbd;
		if (!kbd || !this.canvas.isConnected) return;
		const w = kbd.offsetWidth;
		const h = this.height;
		const dpr = window.devicePixelRatio || 1;
		if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
			this.canvas.width = Math.round(w * dpr);
			this.canvas.height = Math.round(h * dpr);
			// CSSOM sizing is allowed by the style-src CSP (only inline style attributes are not).
			this.canvas.style.width = `${w}px`;
			this.canvas.style.height = `${h}px`;
		}
		const g = this.canvas.getContext("2d");
		const c = this.colors();
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.fillStyle = c.bg;
		g.fillRect(0, 0, w, h);
		const ppb = h / this.beats;
		g.strokeStyle = c.line;
		g.lineWidth = 1;
		for (let b = Math.ceil(beat); b < beat + this.beats; b++) {
			const y = Math.round(h - (b - beat) * ppb) + 0.5;
			g.beginPath();
			g.moveTo(0, y);
			g.lineTo(w, y);
			g.stroke();
		}
		for (const s of this.steps) {
			if (s.beat + s.span <= beat || s.beat >= beat + this.beats) continue;
			const y1 = h - (s.beat - beat) * ppb;
			const y0 = h - (s.beat + s.dur - beat) * ppb;
			for (const n of s.notes) {
				const box = this.keyboard.keyBox(n.midi);
				if (!box) continue;
				const fill = c.colorOf(n) || c.bar;
				// A held bass note lasts its own length, not just until the next melody step.
				const top = n.dur ? h - (s.beat + n.dur - beat) * ppb : y0;
				g.fillStyle = fill;
				g.fillRect(box.x + 2, top + 1, box.w - 4, Math.max(2, y1 - top - 2));
				g.strokeStyle = c.edge;
				g.strokeRect(box.x + 2.5, top + 1.5, box.w - 5, Math.max(1, y1 - top - 3));
				const text = this.label(n);
				// Labels only where they fit at 13 px (WCAG text size), in black or white for contrast.
				if (text && y1 - top >= 18 && box.w >= 16) {
					g.fillStyle = inkOn(fill);
					g.font = "600 13px system-ui, sans-serif";
					g.textAlign = "center";
					g.textBaseline = "bottom";
					g.fillText(text, box.x + box.w / 2, y1 - 3);
				}
			}
		}
		g.fillStyle = c.edge;
		g.fillRect(0, h - 2, w, 2);
	}

	/**
	 * Animate while playing: getBeat() returns the beat now at the bottom edge. With reduced
	 * motion (system setting) the view jumps once per beat instead of scrolling smoothly.
	 */
	play(getBeat) {
		this.stop();
		const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
		let shown = null;
		const frame = () => {
			const beat = reduce ? Math.floor(getBeat()) : getBeat();
			if (beat !== shown) this.draw((shown = beat));
			this.raf = requestAnimationFrame(frame);
		};
		frame();
	}

	stop() {
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	destroy() {
		this.stop();
		this.keyboard.setLane(null);
	}
}
