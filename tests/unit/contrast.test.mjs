// Colour tokens in src/styles/main.css: every text pair reaches 7:1 (WCAG 1.4.6 AAA) and every
// boundary, focus ring and state colour 3:1 (1.4.11), in the dark default and in the light
// theme. Also checks that the two light blocks ([data-theme="light"] and the system setting)
// define the same values, so they cannot drift apart.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../../src/styles/main.css", import.meta.url), "utf8");

function block(selectorRe) {
	const m = selectorRe.exec(css);
	assert.ok(m, `block ${selectorRe} not found`);
	const body = css.slice(m.index + m[0].length, css.indexOf("}", m.index + m[0].length));
	return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, k, v]) => [k, v.toLowerCase()]));
}

const dark = block(/^:root \{/m);
const lightAttr = block(/^:root\[data-theme="light"\] \{/m);
const lightSystem = block(/:root:not\(\[data-theme="dark"\]\) \{/);
const light = { ...dark, ...lightAttr };

function luminance(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum, what it is]
const PAIRS = [
	["text", "bg", 7, "body text"],
	["text", "surface", 7, "text on cards and notices"],
	["muted", "bg", 7, "secondary text, captions"],
	["muted", "surface", 7, "secondary text on cards"],
	["link", "bg", 7, "links"],
	["link", "surface", 7, "links on cards"],
	["ok", "bg", 7, "correct answers and connected status (text)"],
	["ok", "surface", 7, "correct answers on cards"],
	["bad", "bg", 7, "wrong answers (text)"],
	["bad", "surface", 7, "wrong answers on cards"],
	["on-cta", "cta", 7, "primary button text"],
	["key-label", "key-white", 7, "note names on white keys"],
	["on-key-state", "key-target", 7, "text on the target key"],
	["on-key-state", "key-wrong", 7, "text on a wrong key"],
	["on-key-state", "key-on", 7, "text on a pressed key"],
	["rule", "bg", 3, "borders and control outlines"],
	["rule", "surface", 3, "borders on cards"],
	["accent", "bg", 3, "current-page underline, brand icon"],
	["key-border", "key-white", 3, "white key outlines"],
	["key-black", "key-white", 3, "black keys against white keys"],
	["key-target", "key-white", 3, "target key against other keys"],
	["key-wrong", "key-white", 3, "wrong key against other keys"],
	["key-on", "key-white", 3, "pressed key against other keys"],
	["focus-ink", "focus", 3, "the two focus rings against each other"],
];

for (const [name, tokens] of [
	["dark", dark],
	["light", light],
]) {
	test(`${name} theme: token pairs meet AAA text and 3:1 non-text contrast`, () => {
		for (const [fg, bg, min, what] of PAIRS) {
			assert.ok(tokens[fg] && tokens[bg], `${name}: missing --${fg} or --${bg}`);
			const r = ratio(tokens[fg], tokens[bg]);
			assert.ok(r >= min, `${name}: --${fg} ${tokens[fg]} on --${bg} ${tokens[bg]} is ${r.toFixed(2)}:1, needs ${min}:1 (${what})`);
		}
	});

	test(`${name} theme: the dual focus ring shows 3:1 against the page`, () => {
		const best = Math.max(ratio(tokens.focus, tokens.bg), ratio(tokens["focus-ink"], tokens.bg));
		assert.ok(best >= 3, `${name}: neither focus ring reaches 3:1 against --bg (${best.toFixed(2)}:1)`);
	});
}

test("light theme is the same for the theme switch and the system setting", () => {
	assert.deepEqual(lightSystem, Object.fromEntries(Object.entries(lightAttr).filter(([k]) => k in lightSystem)));
	for (const k of Object.keys(lightAttr)) assert.ok(k in lightSystem || lightAttr[k] === dark[k], `--${k} is set for [data-theme="light"] but not in the prefers-color-scheme block`);
});
