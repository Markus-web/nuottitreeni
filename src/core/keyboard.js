// Interactive on-screen piano: real <button>s in one roving-tabindex group, so the whole
// keyboard is a single tab stop. Arrow keys move, Home/End jump, Enter/Space plays. While the
// group has focus, the computer keyboard plays notes by physical key position (QWERTY_MAP),
// Z/X shift the octave; nothing listens globally (WCAG 2.1.4). Marks use a symbol and text as
// well as colour (1.4.1). Emits "key" events: { midi, on }.
import { layoutKeys, whiteKeyName } from "./keyboard-layout.js";
import { QWERTY_MAP, QWERTY_OCTAVE_DOWN, QWERTY_OCTAVE_UP } from "./input/parse.js";
import { MIDDLE_C, blackKeyName, isBlackKey, midiLabel } from "./notes.js";

export class PianoKeyboard extends EventTarget {
	/**
	 * opts: { t, noteNames, low, high, interactive = true, names = true, id }
	 */
	constructor(container, opts) {
		super();
		this.container = container;
		this.t = opts.t;
		this.noteNames = opts.noteNames;
		this.interactive = opts.interactive !== false;
		this.names = opts.names !== false;
		this.id = opts.id || "kbd";
		this.marks = new Map();
		this.pressed = new Set();
		this.focusMidi = null;
		this.baseC = null;
		this.setRange(opts.low, opts.high);
	}

	setRange(low, high) {
		this.low = low;
		this.high = high;
		if (this.focusMidi == null || this.focusMidi < low || this.focusMidi > high) this.focusMidi = MIDDLE_C >= low && MIDDLE_C <= high ? MIDDLE_C : low;
		this.render();
	}

	label(midi) {
		const base = isBlackKey(midi) ? `${blackKeyName(midi, this.noteNames)} (${midiLabel(midi, "letters")})` : midiLabel(midi, this.noteNames);
		const extra = midi === MIDDLE_C ? `, ${this.t("keyboard.middleC")}` : "";
		const mark = this.marks.get(midi);
		const state = mark === "target" ? `, ${this.t("keyboard.target")}` : mark === "wrong" ? `, ${this.t("keyboard.wrong")}` : "";
		return `${base}${extra}${state}`;
	}

	render() {
		const { keys } = layoutKeys(this.low, this.high);
		const hintId = `${this.id}-hint`;
		const wrap = document.createElement("div");
		wrap.className = "kbd-wrap";
		const scroll = document.createElement("div");
		scroll.className = "kbd-scroll";
		const kbd = document.createElement("div");
		kbd.className = `kbd${this.names ? "" : " no-names"}`;
		if (this.interactive) {
			kbd.setAttribute("role", "group");
			kbd.setAttribute("aria-label", this.t("keyboard.label"));
			kbd.setAttribute("aria-describedby", hintId);
		} else kbd.setAttribute("aria-hidden", "true");
		this.buttons = new Map();
		for (const k of keys) {
			const el = document.createElement(this.interactive ? "button" : "span");
			if (this.interactive) {
				el.type = "button";
				el.tabIndex = k.midi === this.focusMidi ? 0 : -1;
			}
			el.className = `key ${k.black ? `key-black pos-${k.pos}` : "key-white"}`;
			el.dataset.midi = String(k.midi);
			const mark = document.createElement("span");
			mark.className = "key-mark";
			mark.setAttribute("aria-hidden", "true");
			el.append(mark);
			if (!k.black) {
				const name = document.createElement("span");
				name.className = "key-name";
				name.setAttribute("aria-hidden", "true");
				name.textContent = whiteKeyName(k.midi, this.noteNames);
				el.append(name);
			}
			if (k.midi === MIDDLE_C) {
				const dot = document.createElement("span");
				dot.className = "key-c4";
				dot.setAttribute("aria-hidden", "true");
				el.append(dot);
			}
			if (this.interactive) el.setAttribute("aria-label", this.label(k.midi));
			this.buttons.set(k.midi, el);
			kbd.append(el);
		}
		scroll.append(kbd);
		wrap.append(scroll);
		if (this.interactive) {
			const hint = document.createElement("p");
			hint.className = "hint";
			hint.id = hintId;
			hint.textContent = this.t("keyboard.hint");
			wrap.append(hint);
			this.bind(kbd);
		}
		this.kbd = kbd;
		this.scroll = scroll;
		this.container.replaceChildren(wrap);
		for (const [midi, state] of this.marks) this.applyMark(midi, state);
		requestAnimationFrame(() => this.scrollTo(this.focusMidi));
	}

	bind(kbd) {
		kbd.addEventListener("pointerdown", (e) => {
			const el = e.target.closest(".key");
			if (!el) return;
			e.preventDefault();
			const midi = Number(el.dataset.midi);
			this.setFocus(midi, true);
			this.press(midi);
			const up = () => {
				this.release(midi);
				removeEventListener("pointerup", up);
				removeEventListener("pointercancel", up);
			};
			addEventListener("pointerup", up);
			addEventListener("pointercancel", up);
		});
		kbd.addEventListener("keydown", (e) => {
			if (e.altKey || e.ctrlKey || e.metaKey) return;
			const step = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 12, ArrowDown: -12 }[e.key];
			if (step) {
				e.preventDefault();
				this.setFocus(Math.max(this.low, Math.min(this.high, this.focusMidi + step)), true);
				return;
			}
			if (e.key === "Home" || e.key === "End") {
				e.preventDefault();
				this.setFocus(e.key === "Home" ? this.low : this.high, true);
				return;
			}
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				if (!e.repeat) this.press(this.focusMidi);
				return;
			}
			if (e.code === QWERTY_OCTAVE_DOWN || e.code === QWERTY_OCTAVE_UP) {
				e.preventDefault();
				this.baseC = this.qwertyBase() + (e.code === QWERTY_OCTAVE_UP ? 12 : -12);
				return;
			}
			if (e.code in QWERTY_MAP) {
				e.preventDefault();
				if (e.repeat) return;
				const midi = this.qwertyBase() + QWERTY_MAP[e.code];
				if (midi >= 21 && midi <= 108) this.press(midi);
			}
		});
		kbd.addEventListener("keyup", (e) => {
			if (e.key === "Enter" || e.key === " ") this.release(this.focusMidi);
			else if (e.code in QWERTY_MAP) this.release(this.qwertyBase() + QWERTY_MAP[e.code]);
		});
		kbd.addEventListener("focusout", (e) => {
			if (!kbd.contains(e.relatedTarget)) for (const m of [...this.pressed]) this.release(m);
		});
	}

	qwertyBase() {
		if (this.baseC == null) this.baseC = this.focusMidi - (this.focusMidi % 12);
		return this.baseC;
	}

	setFocus(midi, moveFocus) {
		const prev = this.buttons.get(this.focusMidi);
		if (prev) prev.tabIndex = -1;
		this.focusMidi = midi;
		const el = this.buttons.get(midi);
		if (!el) return;
		el.tabIndex = 0;
		if (moveFocus) el.focus({ preventScroll: true });
		this.scrollTo(midi);
	}

	scrollTo(midi) {
		const el = this.buttons?.get(midi);
		if (!el || !this.scroll) return;
		const left = el.offsetLeft - this.scroll.clientWidth / 2 + el.offsetWidth / 2;
		this.scroll.scrollLeft = Math.max(0, left);
	}

	press(midi) {
		if (this.pressed.has(midi)) return;
		this.pressed.add(midi);
		this.setOn(midi, true);
		this.dispatchEvent(new CustomEvent("key", { detail: { midi, on: true } }));
	}

	release(midi) {
		if (!this.pressed.delete(midi)) return;
		this.setOn(midi, false);
		this.dispatchEvent(new CustomEvent("key", { detail: { midi, on: false } }));
	}

	/** Visual "sounding" state for notes from any source. */
	setOn(midi, on) {
		this.buttons?.get(midi)?.classList.toggle("is-on", on);
	}

	mark(midi, state) {
		if (state) this.marks.set(midi, state);
		else this.marks.delete(midi);
		this.applyMark(midi, state);
	}

	applyMark(midi, state) {
		const el = this.buttons?.get(midi);
		if (!el) return;
		el.classList.toggle("is-target", state === "target");
		el.classList.toggle("is-wrong", state === "wrong");
		el.querySelector(".key-mark").textContent = state === "target" ? "✓" : state === "wrong" ? "✗" : "";
		if (this.interactive) el.setAttribute("aria-label", this.label(midi));
	}

	clearMarks() {
		for (const midi of [...this.marks.keys()]) this.mark(midi, null);
	}

	setNames(on) {
		this.names = on;
		this.kbd?.classList.toggle("no-names", !on);
	}
}
