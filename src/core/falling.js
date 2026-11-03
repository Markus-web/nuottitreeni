// Falling notes above the on-screen keyboard (a piano-roll view as in Midiano): coming notes
// are bars that fall onto their keys; the bottom edge is "now". The canvas sits in the
// keyboard's own scroller (PianoKeyboard.setLane), so it lines up with the keys at any scroll
// position and in both themes (colours come from the CSS tokens).
//
// Accessibility: decorative and aria-hidden; the score, the key marks and the status line
// carry the same information. It is off by default, moves only while a tempo run or Listen
// plays (stopped with the Stop button, WCAG 2.2.2) and otherwise redraws once per step.
export class FallingNotes {
	/** keyboard: PianoKeyboard; beats: how many beats are visible above the keys. */
	constructor(keyboard, { beats = 4, height = 160 } = {}) {
		this.keyboard = keyboard;
		this.beats = beats;
		this.height = height;
		this.steps = [];
		this.raf = 0;
		this.canvas = document.createElement("canvas");
		this.canvas.className = "falling";
		this.canvas.setAttribute("aria-hidden", "true");
		keyboard.setLane(this.canvas);
	}

	/** steps: [{ notes: [{ midi }], beat }] in order; durations run to the next step. */
	setSteps(steps) {
		this.steps = steps.map((s, i) => ({ notes: s.notes, beat: s.beat, dur: Math.max(0.25, (steps[i + 1]?.beat ?? s.beat + 1) - s.beat) }));
	}

	colors() {
		const cs = getComputedStyle(document.documentElement);
		const v = (name) => cs.getPropertyValue(name).trim();
		// Note colours setting: white-key notes take their letter's colour, black keys stay --link.
		const notes = document.documentElement.hasAttribute("data-note-colors") ? [..."c d ef g a b"].map((s) => (s === " " ? null : v(`--n-${s}`))) : [];
		return { bg: v("--surface"), bar: v("--link"), edge: v("--text"), line: v("--rule"), notes };
	}

	/** Draw the view with `beat` at the bottom edge. */
	draw(beat) {
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
			if (s.beat + s.dur <= beat || s.beat >= beat + this.beats) continue;
			const y1 = h - (s.beat - beat) * ppb;
			const y0 = h - (s.beat + s.dur - beat) * ppb;
			for (const n of s.notes) {
				const box = this.keyboard.keyBox(n.midi);
				if (!box) continue;
				g.fillStyle = c.notes[n.midi % 12] || c.bar;
				g.fillRect(box.x + 2, y0 + 1, box.w - 4, Math.max(2, y1 - y0 - 2));
				g.strokeStyle = c.edge;
				g.strokeRect(box.x + 2.5, y0 + 1.5, box.w - 5, Math.max(1, y1 - y0 - 3));
			}
		}
		g.fillStyle = c.edge;
		g.fillRect(0, h - 2, w, 2);
	}

	/** Animate while playing: getBeat() returns the beat now at the bottom edge. */
	play(getBeat) {
		this.stop();
		const frame = () => {
			this.draw(getBeat());
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
