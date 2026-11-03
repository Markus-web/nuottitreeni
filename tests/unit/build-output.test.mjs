// Runs scripts/build.mjs twice into temp directories (never dist/): once like an official
// instance (site URL, indexable, Finnish default) and once with the deploy-button defaults.
// Checks routes per locale, that every referenced asset exists, sitemap = indexable pages,
// noindex on clones, the service worker lists and the generated _headers.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import en from "../../src/content/locales/en.js";
import fi from "../../src/content/locales/fi.js";
import { headersFile } from "../../worker/headers.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const INSTANCE = { NT_SITE_URL: "https://piano.example", NT_INDEXABLE: "1", NT_DEFAULT_LOCALE: "fi", NT_LOCALES: "fi,en", NT_OPERATOR_NAME: "Test Operator", NT_OPERATOR_CONTACT: "ops@example.org" };
const CLEAR = ["NT_SITE_URL", "NT_INDEXABLE", "NT_DEFAULT_LOCALE", "NT_LOCALES", "NT_OPERATOR_NAME", "NT_OPERATOR_CONTACT", "NT_OPERATOR_PLACE", "NT_SOURCE_URL"];
const dirs = {};

function build(extra) {
	const out = mkdtempSync(join(tmpdir(), "nt-build-"));
	const env = { ...process.env, NT_OUT_DIR: out };
	for (const k of CLEAR) delete env[k];
	Object.assign(env, extra);
	execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { cwd: root, env, stdio: "pipe" });
	return out;
}

function files(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
}
const html = (dir) => files(dir).filter((f) => f.endsWith(".html"));

before(() => {
	dirs.instance = build(INSTANCE);
	dirs.template = build({});
});
after(() => {
	for (const d of Object.values(dirs)) rmSync(d, { recursive: true, force: true });
});

test("every locale has its pages; the default locale is at /", () => {
	const d = dirs.instance;
	const fiLesson = `${fi.slugs.pages.lessons}/${fi.slugs.lessons.keys}/index.html`;
	const enLesson = `en/${en.slugs.pages.lessons}/${en.slugs.lessons.keys}/index.html`;
	const fiPiece = `${fi.slugs.pages.pieces}/${fi.slugs.pieces["ukko-nooa"]}/index.html`;
	for (const p of ["index.html", "en/index.html", fiLesson, enLesson, fiPiece, "404.html"]) {
		assert.ok(existsSync(join(d, p)), p);
	}
	assert.match(readFileSync(join(d, "index.html"), "utf8"), /<html lang="fi">/);
	assert.match(readFileSync(join(d, "en/index.html"), "utf8"), /<html lang="en">/);
	assert.match(readFileSync(join(dirs.template, "index.html"), "utf8"), /<html lang="en">/);
});

test("every local URL in the HTML points at a file that exists", () => {
	for (const d of [dirs.instance, dirs.template]) {
		const missing = new Set();
		for (const f of html(d)) {
			const text = readFileSync(f, "utf8");
			const urls = [...text.matchAll(/(?:href|src)="(\/[^"#?]*)/g)].map((m) => m[1]);
			for (const m of text.matchAll(/srcset="([^"]+)"/g)) urls.push(...m[1].split(",").map((s) => s.trim().split(/\s+/)[0]));
			for (const u of urls) {
				const target = u.endsWith("/") ? join(d, u, "index.html") : join(d, u);
				if (!existsSync(target)) missing.add(`${relative(d, f)} -> ${u}`);
			}
		}
		assert.deepEqual([...missing], []);
	}
});

test("sitemap lists exactly the indexable pages; interactive pages are noindex", () => {
	const d = dirs.instance;
	const sitemap = readFileSync(join(d, "sitemap.xml"), "utf8");
	const listed = new Set([...sitemap.matchAll(/<loc>https:\/\/piano\.example(\/[^<]*)<\/loc>/g)].map((m) => m[1]));
	const indexable = new Set();
	for (const f of html(d)) {
		const text = readFileSync(f, "utf8");
		const path = `/${relative(d, f).replace(/index\.html$/, "")}`;
		if (/<meta name="robots" content="index, follow">/.test(text)) indexable.add(path);
	}
	assert.deepEqual([...listed].sort(), [...indexable].sort());
	assert.ok(!listed.has(`/${fi.slugs.pages.practice}/`) && !listed.has(`/${fi.slugs.pages.settings}/`));
	assert.match(readFileSync(join(d, "robots.txt"), "utf8"), /Sitemap: https:\/\/piano\.example\/sitemap\.xml/);
});

test("a deploy-button build is noindex everywhere and blocks crawlers", () => {
	const d = dirs.template;
	assert.equal(readFileSync(join(d, "robots.txt"), "utf8"), "User-agent: *\nDisallow: /\n");
	assert.ok(!existsSync(join(d, "sitemap.xml")));
	for (const f of html(d)) assert.match(readFileSync(f, "utf8"), /<meta name="robots" content="noindex, follow">/, relative(d, f));
});

test("service worker precaches the shell but not samples, the notation engine or large photos", () => {
	const sw = readFileSync(join(dirs.instance, "sw.js"), "utf8");
	const lists = [...sw.matchAll(/\[("\/[^\]]*")\]/g)].map((m) => JSON.parse(`[${m[1]}]`));
	const shell = lists.find((l) => l.includes("/"));
	const heavy = lists.find((l) => l.some((u) => u.startsWith("/assets/piano/")));
	assert.ok(shell && heavy, "SHELL and HEAVY lists found");
	assert.ok(shell.includes("/en/") && shell.includes(`/${fi.slugs.pages.lessons}/${fi.slugs.lessons.keys}/`));
	assert.ok(!shell.some((u) => u.startsWith("/assets/piano/") || u.startsWith("/assets/vendor/")));
	const photos = shell.filter((u) => u.startsWith("/assets/photos/"));
	assert.ok(photos.length > 0 && photos.every((u) => /-480-[0-9a-f]+\.avif$/.test(u)), photos.join(" "));
	assert.ok(heavy.some((u) => u.startsWith("/assets/vendor/osmd")));
});

test("_headers is generated from worker/headers.js", () => {
	assert.equal(readFileSync(join(dirs.instance, "_headers"), "utf8"), headersFile());
});
