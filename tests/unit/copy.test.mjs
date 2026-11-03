// Writing rules (tests/copy-rules.json) on every text a person reads: UI strings in all
// locales, the privacy notice and accessibility statement, the licence notes and the
// Markdown docs. Code blocks and inline code in Markdown are skipped.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import legal from "../../src/content/legal.js";
import { LICENSES } from "../../src/content/licenses.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const { rules } = JSON.parse(readFileSync(join(root, "tests/copy-rules.json"), "utf8"));
const compiled = rules.map((r) => ({ ...r, re: new RegExp(r.pattern, `${r.caseSensitive ? "" : "i"}${r.unicode ? "u" : ""}`) }));

function strings(value, path, out) {
	if (typeof value === "string") out.push([path, value]);
	else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
	else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) strings(v, path ? `${path}.${k}` : k, out);
	return out;
}

function check(lang, entries) {
	const hits = [];
	for (const [where, text] of entries) {
		for (const r of compiled) {
			if (r.lang && r.lang !== lang) continue;
			const m = r.re.exec(text);
			if (m) hits.push(`${where}: [${r.id}] "${m[0]}"${r.note ? ` (${r.note})` : ""}`);
		}
	}
	return hits;
}

const localeDir = join(root, "src/content/locales");
for (const file of readdirSync(localeDir).filter((f) => f.endsWith(".js"))) {
	const lang = file.replace(/\.js$/, "");
	test(`copy rules: UI strings (${lang})`, async () => {
		const dict = (await import(join(localeDir, file))).default;
		const hits = check(lang, strings(dict, `${lang}`, []));
		assert.deepEqual(hits, []);
	});
}

test("copy rules: privacy notice and accessibility statement", () => {
	const hits = Object.entries(legal).flatMap(([lang, doc]) => check(lang, strings(doc, `legal.${lang}`, [])));
	assert.deepEqual(hits, []);
});

test("copy rules: licence notes", () => {
	const hits = ["fi", "en"].flatMap((lang) => check(lang, LICENSES.map((l) => [`licenses.${l.name}.${lang}`, l.use[lang] ?? ""])));
	assert.deepEqual(hits, []);
});

// Quoted third-party text, kept word for word.
const VERBATIM = new Set(["CODE_OF_CONDUCT.md"]);

function markdownFiles() {
	const out = readdirSync(root).filter((f) => f.endsWith(".md") && !VERBATIM.has(f)).map((f) => join(root, f));
	for (const dir of ["docs", "docs/decisions", ".github", ".github/ISSUE_TEMPLATE"]) {
		const d = join(root, dir);
		if (existsSync(d)) out.push(...readdirSync(d).filter((f) => /\.(md|ya?ml)$/.test(f)).map((f) => join(d, f)));
	}
	return out;
}

test("copy rules: Markdown docs and GitHub templates", () => {
	const hits = [];
	for (const file of markdownFiles()) {
		const text = readFileSync(file, "utf8")
			.replace(/```[\s\S]*?```/g, "")
			.replace(/`[^`\n]*`/g, "");
		const lang = /\.fi\.md$/.test(file) ? "fi" : "en";
		const lines = text.split("\n").map((line, i) => [`${file.slice(root.length)}:${i + 1}`, line]);
		hits.push(...check(lang, lines));
	}
	assert.deepEqual(hits, []);
});
