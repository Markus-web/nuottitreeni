// The browser's copy of the locale strings (src/content/locale-browser.js) leaves out texts only
// the build uses. This test fails when browser code starts to read one of them, so the cut can
// never hide a string from a page.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { BUILD_ONLY_FIELDS, BUILD_ONLY_SECTIONS, browserLocale } from "../../src/content/locale-browser.js";
import en from "../../src/content/locales/en.js";
import fi from "../../src/content/locales/fi.js";

const src = fileURLToPath(new URL("../../src", import.meta.url));
// Browser code: page entries and core modules (templates run only in the build).
const files = ["pages", "core", "core/input"].flatMap((dir) =>
	readdirSync(join(src, dir))
		.filter((f) => f.endsWith(".js"))
		.map((f) => join(src, dir, f)),
);
const code = files.map((f) => readFileSync(f, "utf8")).join("\n");

test("browser code never reads a build-only text", () => {
	for (const section of BUILD_ONLY_SECTIONS) {
		assert.ok(!new RegExp(`(dict\\.${section}\\b|t\\(["\`]${section}\\.)`).test(code), `browser code reads "${section}"`);
	}
	for (const [section, fields] of Object.entries(BUILD_ONLY_FIELDS)) for (const field of fields) assert.ok(!new RegExp(`\\.${field}\\b`).test(code), `browser code reads ${section}.*.${field}`);
	assert.ok(code.includes("dict.lessons") && code.includes("dict.piecesMeta"), "the kept sections are still used");
});

test("the browser copy keeps everything else", () => {
	for (const dict of [fi, en]) {
		const b = browserLocale(dict);
		for (const section of BUILD_ONLY_SECTIONS) assert.equal(b[section], undefined, section);
		assert.equal(b.lessons["treble-c4-g4"].learn, undefined);
		assert.equal(b.lessons["treble-c4-g4"].title, dict.lessons["treble-c4-g4"].title);
		assert.equal(b.lessons["treble-c4-g4"].hint, dict.lessons["treble-c4-g4"].hint);
		assert.equal(b.piecesMeta["ukko-nooa"].title, dict.piecesMeta["ukko-nooa"].title);
		assert.deepEqual(b.howto, dict.howto);
		assert.deepEqual(b.meta, dict.meta);
		assert.ok(JSON.stringify(b).length < JSON.stringify(dict).length * 0.75, "a clearly smaller copy");
	}
});
