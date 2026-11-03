import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMelody, toStaffItems } from "../../src/core/notation.js";
import { parseNoteKey } from "../../src/core/notes.js";
import { renderStaff } from "../../src/core/staff.js";

const note = (key, clef = "treble", extra = {}) => ({ type: "note", value: "q", notes: [{ ...parseNoteKey(key), clef, written: null }], ...extra });

test("single drill note: accessible name, one head, ledger line for middle C", () => {
	const svg = renderStaff({ staff: "treble", items: [note("C4")], label: "Harjoitusnuotti" });
	assert.match(svg, /^<svg [^>]*role="img" aria-label="Harjoitusnuotti"/);
	assert.equal((svg.match(/class="st-head"/g) || []).length, 1);
	assert.equal((svg.match(/st-ledger/g) || []).length, 1);
});

test("decorative staff is hidden from assistive technology", () => {
	assert.match(renderStaff({ staff: "bass", items: [note("G2", "bass")] }), /aria-hidden="true"/);
});

test("labels, states and data attributes", () => {
	const svg = renderStaff({ staff: "treble", items: [note("E4", "treble", { label: "E", state: "current", midi: 64 })] });
	assert.match(svg, /class="st-label"[^>]*>E<\/text>/);
	assert.match(svg, /class="st-item is-current" data-midi="64"/);
	assert.match(svg, /class="st-marker"/);
});

test("rhythm values: open heads, no stem on whole notes, dots, beams, rests", () => {
	const svg = renderStaff({ staff: "treble", timeSig: [4, 4], items: toStaffItems(parseMelody("B4w | B4hd B4q | B4e B4e B4q rh"), "treble") });
	assert.equal((svg.match(/st-head st-open/g) || []).length, 2);
	assert.match(svg, /class="st-time"[^>]*>4<\/text>/);
	assert.equal((svg.match(/<circle /g) || []).length, 1, "one dot");
	assert.match(svg, /<polygon /, "beam");
	assert.match(svg, /class="st-rest"/);
});

test("key signature and grand staff render", () => {
	const svg = renderStaff({ staff: "grand", keySig: { F: 1, C: 1 }, items: [note("C3", "bass"), note("C5")] });
	assert.equal((svg.match(/st-sig/g) || []).length, 4, "two sharps on each staff");
	assert.equal((svg.match(/st-clef-treble/g) || []).length, 1);
	assert.equal((svg.match(/st-clef-bass/g) || []).length, 1);
});

test("output is deterministic and escapes text", () => {
	const a = renderStaff({ staff: "treble", items: [note("D4", "treble", { label: "<D>" })], label: 'Nuotti "D"' });
	assert.equal(a, renderStaff({ staff: "treble", items: [note("D4", "treble", { label: "<D>" })], label: 'Nuotti "D"' }));
	assert.ok(a.includes("&lt;D&gt;") && a.includes("&quot;D&quot;"));
});

test("two-staff piece scores: bass notes keep their own value, bar numbers on each line", async () => {
	const { PIECES } = await import("../../src/content/catalog.js");
	const { systems } = await import("../../src/core/notation.js");
	const ukko = PIECES.find((p) => p.id === "ukko-nooa");
	const lines = systems(ukko.right, { left: ukko.left });
	const first = lines[0].items.find((it) => it.type === "note");
	assert.equal(first.notes.length, 2, "melody C4 and bass C3 in the first column");
	assert.deepEqual(first.notes.map((n) => [n.clef, n.value]), [["treble", undefined], ["bass", "w"]]);
	const svg = renderStaff({ staff: "grand", items: lines[1].items, barNumber: lines[1].firstBar, label: "Ukko Nooa" });
	assert.match(svg, /class="st-barnum"[^>]*>5</, "the second line starts with bar 5");
	// The bass whole note: an open head without a stem; the melody quarter keeps its filled head and stem.
	const col = renderStaff({ staff: "grand", items: [first] });
	assert.equal((col.match(/st-head st-open/g) ?? []).length, 1, "one open head (the bass whole note)");
	assert.equal((col.match(/class="st-stem"/g) ?? []).length, 1, "one stem (the melody quarter)");
});
