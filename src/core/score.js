// OpenSheetMusicDisplay wrapper (vendored, BSD-3-Clause; loaded only on piece pages).
// Loads MusicXML text or MXL (zip, passed as a binary string), renders it with the page's
// theme colours, and turns the cursor positions into practice steps.
//
// OSMD pitch numbering: halfTone = note + 12 * xmlOctave (its octXmlDiff is 3), so
// MIDI = halfTone + 12. Checked against the bundle in src/vendor/osmd.

let libPromise = null;

export function loadOsmd(url) {
	if (!libPromise)
		libPromise = new Promise((resolve, reject) => {
			const s = document.createElement("script");
			s.src = url;
			s.async = true;
			s.onload = () => (window.opensheetmusicdisplay ? resolve(window.opensheetmusicdisplay) : reject(new Error("OSMD missing")));
			s.onerror = () => reject(new Error("OSMD failed to load"));
			document.head.append(s);
		});
	return libPromise;
}

function themeColors() {
	const cs = getComputedStyle(document.documentElement);
	return { fg: cs.getPropertyValue("--text").trim() || "#000", cursor: cs.getPropertyValue("--link").trim() || "#065064" };
}

export async function createScore(container, osmdUrl) {
	const lib = await loadOsmd(osmdUrl);
	const c = themeColors();
	const osmd = new lib.OpenSheetMusicDisplay(container, {
		autoResize: true,
		backend: "svg",
		drawTitle: false,
		drawSubtitle: false,
		drawComposer: false,
		drawLyricist: false,
		drawCredits: false,
		drawPartNames: false,
		drawPartAbbreviations: false,
		drawMeasureNumbers: true,
		followCursor: true,
		autoBeam: true,
		defaultColorMusic: c.fg,
		defaultColorLabel: c.fg,
		defaultColorTitle: c.fg,
		cursorsOptions: [{ type: 0, color: c.cursor, alpha: 0.45, follow: true }],
	});
	return osmd;
}

/** Re-apply theme colours (after a theme change) and redraw. */
export function recolor(osmd) {
	const c = themeColors();
	osmd.setOptions({ defaultColorMusic: c.fg, defaultColorLabel: c.fg, defaultColorTitle: c.fg, cursorsOptions: [{ type: 0, color: c.cursor, alpha: 0.45, follow: true }] });
	osmd.render();
}

export async function loadScore(osmd, source) {
	await osmd.load(source);
	osmd.render();
	osmd.cursor.show();
}

/**
 * Practice steps from the cursor: [{ notes: [{ midi, hand }], bar, beat, iter }] where beat is
 * the position in quarter notes from the start and iter is the cursor index of the step.
 * Rest-only positions and tied continuation notes are skipped. Staff 0 is the right hand.
 */
export function extractSteps(osmd) {
	const c = osmd.cursor;
	c.reset();
	const steps = [];
	let iter = 0;
	while (!c.iterator.EndReached && iter < 50000) {
		const notes = [];
		for (const n of c.NotesUnderCursor()) {
			if (n.isRest?.() || n.halfTone == null) continue;
			if (n.NoteTie && n.NoteTie.StartNote !== n) continue;
			const staff = n.ParentStaffEntry?.ParentStaff?.idInMusicSheet ?? 0;
			const midi = n.halfTone + 12;
			if (!notes.some((x) => x.midi === midi)) notes.push({ midi, hand: staff === 0 ? "right" : "left" });
		}
		if (notes.length) steps.push({ notes, bar: (c.iterator.CurrentMeasureIndex ?? 0) + 1, beat: (c.iterator.currentTimeStamp?.RealValue ?? 0) * 4, iter });
		c.next();
		iter++;
	}
	c.reset();
	return steps;
}

/** Move the cursor to a cursor index (reset + next). */
export function cursorTo(osmd, iter) {
	const c = osmd.cursor;
	c.reset();
	for (let i = 0; i < iter && !c.iterator.EndReached; i++) c.next();
}

/** Binary string for OSMD's MXL support from an ArrayBuffer. */
export function toBinaryString(buffer) {
	const bytes = new Uint8Array(buffer);
	let s = "";
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
	return s;
}
