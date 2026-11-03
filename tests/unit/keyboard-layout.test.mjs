// Keyboard sizes and playable ranges (src/core/keyboard-layout.js), used by the Devices page and
// the range warning on piece pages.
import assert from "node:assert/strict";
import { test } from "node:test";
import { KEYBOARD_SIZES, knownKeyboardSize, playableRange } from "../../src/core/keyboard-layout.js";

test("every keyboard size covers exactly that many keys", () => {
	for (const [n, [lo, hi]] of Object.entries(KEYBOARD_SIZES)) assert.equal(hi - lo + 1, Number(n), `${n} keys`);
	assert.deepEqual(KEYBOARD_SIZES[88], [21, 108], "A0 to C8");
	assert.deepEqual(KEYBOARD_SIZES[76], [28, 103], "E1 to G7");
});

test("the Yamaha DGX-205 and DGX-203 are known 76-key keyboards", () => {
	assert.equal(knownKeyboardSize("Digital Keyboard (DGX-205)"), 76);
	assert.equal(knownKeyboardSize("DGX203"), 76);
	assert.equal(knownKeyboardSize("USB MIDI Interface"), null);
	assert.equal(knownKeyboardSize(), null);
});

test("the playable range follows the octave shift and transpose", () => {
	assert.deepEqual(playableRange(61), [36, 96]);
	assert.deepEqual(playableRange(61, 1), [48, 108]);
	assert.deepEqual(playableRange(61, -1, 2), [26, 86]);
	assert.deepEqual(playableRange(99), [21, 108], "an unknown size counts as a full piano");
});
