import assert from "node:assert/strict";
import { test } from "node:test";
import { fmt, makeT } from "../../src/core/i18n.js";
import en from "../../src/content/locales/en.js";
import fi from "../../src/content/locales/fi.js";

test("lookup with fallback and interpolation", () => {
	const t = makeT(fi, en);
	assert.equal(t("drill.count", { i: 3, n: 20 }), "Nuotti 3/20");
	assert.equal(t("no.such.key"), "no.such.key");
	const partial = makeT({ drill: {} }, en);
	assert.equal(partial("drill.correct"), "Correct!");
});

test("locale number formats", () => {
	assert.match(fmt("fi-FI").percent(90), /^90\s%$/);
	assert.equal(fmt("en-GB").percent(90), "90%");
	assert.equal(fmt("fi-FI").seconds(1500), "1,5");
	assert.equal(fmt("en-GB").seconds(1500), "1.5");
});
