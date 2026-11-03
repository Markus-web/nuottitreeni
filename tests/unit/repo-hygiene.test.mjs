// Repository hygiene, so the code base stays easy to maintain:
//   - every translation key is used (an unused key is usually a feature that was never
//     finished, or text left behind by a removed one)
//   - every relative link and #anchor in the Markdown docs resolves (GitHub rules)
//   - every script in scripts/ starts with a header comment that says what it does
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import fi from "../../src/content/locales/fi.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

function walk(dir, filter, out = []) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (["node_modules", "dist", ".wrangler", "artifacts", ".git"].includes(e.name)) continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) walk(p, filter, out);
		else if (filter(p)) out.push(p);
	}
	return out;
}

// Keys read through a computed path (t(`modes.${m}.label`), dict.lessons[id], ...). Every
// key under these prefixes counts as used; the content tests check their parity instead.
const DYNAMIC = ["meta.", "slugs.", "lessons.", "rhythm.", "piecesMeta.", "modes.", "keySigNames.", "theme.", "free.clef.", "settings.noteNamesOptions.", "explain.", "piece.values.", "piece.keyMajor.", "piece.keyMinor.", "photos.", "glossary", "help", "about.body", "device.status", "site.", "notFound.", "howto."];

test("every translation key is used somewhere in the code", () => {
	const keys = [];
	(function collect(o, p) {
		for (const [k, v] of Object.entries(o)) {
			const path = p ? `${p}.${k}` : k;
			if (v && typeof v === "object" && !Array.isArray(v)) collect(v, path);
			else keys.push(path);
		}
	})(fi, "");
	const code = [...walk(join(root, "src"), (p) => /\.m?js$/.test(p) && !p.includes(`${join("src", "content", "locales")}`)), ...walk(join(root, "scripts"), (p) => p.endsWith(".mjs"))]
		.map((f) => readFileSync(f, "utf8"))
		.join("\n");
	const unused = keys.filter((k) => !DYNAMIC.some((d) => k.startsWith(d)) && !code.includes(`"${k}"`) && !code.includes(`\`${k}`));
	assert.deepEqual(unused, [], "remove these keys or use them");
});

/** GitHub's heading anchor: lower case, punctuation removed, spaces to hyphens. */
export function slug(heading) {
	return heading
		.trim()
		.toLowerCase()
		.replace(/[`*_~]/g, "")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.replace(/\s/g, "-");
}

function anchors(file) {
	const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
	const seen = new Map();
	const out = new Set();
	for (const m of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
		const base = slug(m[1]);
		const n = seen.get(base) ?? 0;
		seen.set(base, n + 1);
		out.add(n ? `${base}-${n}` : base);
	}
	return out;
}

test("relative links and anchors in the Markdown docs resolve", () => {
	const broken = [];
	for (const file of walk(root, (p) => p.endsWith(".md"))) {
		const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
		for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
			const url = m[1];
			if (/^(https?:|mailto:)/.test(url)) continue;
			const [path, anchor] = url.split("#");
			const target = path ? join(dirname(file), path) : file;
			const where = `${relative(root, file)} -> ${url}`;
			if (!existsSync(target)) {
				broken.push(`${where} (missing file)`);
				continue;
			}
			if (anchor && target.endsWith(".md") && statSync(target).isFile() && !anchors(target).has(anchor)) broken.push(`${where} (missing heading)`);
		}
	}
	assert.deepEqual(broken, []);
});

test("every script starts with a header comment", () => {
	const missing = readdirSync(join(root, "scripts"))
		.filter((f) => /\.(mjs|sh)$/.test(f))
		.filter((f) => {
			const head = readFileSync(join(root, "scripts", f), "utf8").split("\n").slice(0, 3).join("\n");
			return !/^(#!.*\n)?(\/\/|#) \S/m.test(head);
		});
	assert.deepEqual(missing, []);
});
