#!/usr/bin/env node
// Builds the static site into dist/: bundled and hashed JS/CSS, fonts, icons, piano samples,
// built-in pieces as MusicXML, every page in every locale, sitemap, robots.txt, llms.txt,
// web app manifest, security headers and the service worker. Fails on size budgets.
//
// Configuration (environment variables, all optional; see docs/configuration.md):
//   NT_SITE_URL         https://example.org   absolute URLs, canonical, hreflang, sitemap, OG images
//   NT_DEFAULT_LOCALE   en                    locale served at "/"
//   NT_LOCALES          en,fi                 locales to build (each needs src/content/locales/<code>.js)
//   NT_INDEXABLE        0                     1 = allow search engines (needs NT_SITE_URL)
//   NT_OPERATOR_NAME / NT_OPERATOR_CONTACT / NT_OPERATOR_PLACE   baked into privacy/about pages
//   NT_SOURCE_URL       https://github.com/Markus-web/nuottitreeni
//   NT_SKIP_BUDGET      1                     report sizes but do not fail on budgets
//   NT_OUT_DIR          dist                  output directory (tests build into a temp dir)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";
import pkg from "../package.json" with { type: "json" };
import { headersFile } from "../worker/headers.js";

const env = process.env;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = env.NT_OUT_DIR ? resolve(env.NT_OUT_DIR) : join(root, "dist");

// ---- configuration --------------------------------------------------------------------
const locales = (env.NT_LOCALES || "en,fi").split(",").map((s) => s.trim()).filter(Boolean);
const defaultLocale = env.NT_DEFAULT_LOCALE || locales[0];
if (!locales.includes(defaultLocale)) throw new Error(`NT_DEFAULT_LOCALE ${defaultLocale} is not in NT_LOCALES`);
const siteUrl = (env.NT_SITE_URL || "").replace(/\/+$/, "");
if (siteUrl && !/^https:\/\/[^/]+$/.test(siteUrl)) throw new Error("NT_SITE_URL must be https://host without a path");
const cfg = {
	siteUrl,
	indexable: env.NT_INDEXABLE === "1" && Boolean(siteUrl),
	operatorName: env.NT_OPERATOR_NAME || "",
	operatorContact: env.NT_OPERATOR_CONTACT || "",
	operatorPlace: env.NT_OPERATOR_PLACE || "",
	sourceUrl: env.NT_SOURCE_URL || "https://github.com/Markus-web/nuottitreeni",
	version: pkg.version,
};
function buildDate() {
	if (env.SOURCE_DATE_EPOCH) return new Date(Number(env.SOURCE_DATE_EPOCH) * 1000);
	try {
		return new Date(execFileSync("git", ["log", "-1", "--format=%cI"], { cwd: root, encoding: "utf8" }).trim());
	} catch {
		return new Date();
	}
}
const lastmod = buildDate().toISOString().slice(0, 10);

const dicts = {};
for (const l of locales) dicts[l] = (await import(pathToFileURL(join(src, "content/locales", `${l}.js`)).href)).default;
const enDict = dicts.en ?? (await import(pathToFileURL(join(src, "content/locales/en.js")).href)).default;
const { makeT } = await import("../src/core/i18n.js");
const { makeSite, INDEXABLE } = await import("../src/content/site.js");
const { PIECES, PITCH_LESSONS, RHYTHM_LESSONS } = await import("../src/content/catalog.js");
const { PHOTOS, PHOTO_WIDTHS } = await import("../src/content/photos.js");
const { toMusicXml } = await import("../src/core/notation.js");
const { layout } = await import("../src/templates/layout.js");
const { default: legal } = await import("../src/content/legal.js");
const P = await import("../src/templates/pages.js");
const site = makeSite({ locales, defaultLocale, dicts, siteUrl });

// ---- helpers --------------------------------------------------------------------------
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
function emit(relPath, content) {
	const file = join(dist, relPath);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, content);
	return `/${relPath.replaceAll("\\", "/")}`;
}
function emitHashed(dir, name, ext, content) {
	return emit(`${dir}/${name}-${hash(content)}.${ext}`, content);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// ---- JavaScript -----------------------------------------------------------------------
const ENTRIES = ["home", "guide", "practice", "rhythm", "pieces", "piece", "log", "devices", "settings", "stream", "static", "explore", "speed"];
const { browserLocale } = await import("../src/content/locale-browser.js");
// Locale files reach the browser without the texts only the build uses (src/content/locale-browser.js).
const browserLocales = {
	name: "browser-locales",
	setup(b) {
		b.onLoad({ filter: /[\\/]src[\\/]content[\\/]locales[\\/][a-z]+\.js$/ }, async (args) => {
			const { default: dict } = await import(`${pathToFileURL(args.path).href}?v=${Date.now()}`);
			return { contents: `export default ${JSON.stringify(browserLocale(dict))};`, loader: "js" };
		});
	},
};
const js = await esbuild.build({
	plugins: [browserLocales],
	entryPoints: Object.fromEntries(ENTRIES.map((e) => [e, join(src, "pages", `${e}.js`)])),
	bundle: true,
	splitting: true,
	format: "esm",
	target: "es2022",
	minify: true,
	outdir: join(dist, "assets/js"),
	entryNames: "[name]-[hash]",
	chunkNames: "c-[hash]",
	metafile: true,
	legalComments: "none",
	logLevel: "warning",
	absWorkingDir: root, // metafile paths below are relative to root
});
const entries = {};
const localeChunks = {};
for (const [outPath, info] of Object.entries(js.metafile.outputs)) {
	const url = `/${relative(dist, join(root, outPath)).replaceAll("\\", "/")}`;
	// Page entries; locale files imported with a dynamic glob are emitted as their own entry points.
	const name = info.entryPoint ? ENTRIES.find((e) => info.entryPoint.endsWith(`src/pages/${e}.js`)) : null;
	if (name) entries[name] = { file: url, preload: info.imports.filter((i) => i.kind === "import-statement").map((i) => `/${relative(dist, join(root, i.path)).replaceAll("\\", "/")}`) };
	for (const l of locales) if (Object.keys(info.inputs).some((p) => p.endsWith(`src/content/locales/${l}.js`))) localeChunks[l] = url;
}
for (const l of locales) if (!localeChunks[l]) throw new Error(`locale chunk for ${l} not found: is it imported dynamically in common.js?`);
const themeJs = emitHashed("assets/js", "theme", "js", (await esbuild.transform(readFileSync(join(src, "pages/theme-init.js"), "utf8"), { minify: true, target: "es2017" })).code);

// ---- CSS and fonts --------------------------------------------------------------------
const css = await esbuild.build({
	entryPoints: { main: join(src, "styles/main.css") },
	bundle: true,
	minify: true,
	outdir: dist,
	entryNames: "assets/css/[name]-[hash]",
	assetNames: "assets/fonts/[name]-[hash]",
	loader: { ".woff2": "file" },
	metafile: true,
	logLevel: "warning",
	absWorkingDir: root,
});
let cssUrl = "";
const preloadFonts = [];
for (const outPath of Object.keys(css.metafile.outputs)) {
	const url = `/${relative(dist, join(root, outPath)).replaceAll("\\", "/")}`;
	if (url.endsWith(".css")) cssUrl = url;
	if (url.includes("space-grotesk")) preloadFonts.push(url);
}

// ---- static assets --------------------------------------------------------------------
const iconDir = join(src, "assets/icons");
const icons = {};
for (const [key, file] of Object.entries({ svg: "icon.svg", png32: "icon-32.png", png180: "icon-180.png", png192: "icon-192.png", png512: "icon-512.png", maskable: "icon-maskable-512.png" })) {
	const content = readFileSync(join(iconDir, file));
	icons[key] = emitHashed("assets/icons", file.replace(/\.(svg|png)$/, ""), file.split(".").pop(), content);
}
copyFileSync(join(iconDir, "favicon.ico"), join(dist, "favicon.ico"));
const og = {};
for (const l of locales) {
	const file = join(src, "assets/og", `og-${l}.png`);
	if (existsSync(file)) og[l] = emitHashed("assets/og", `og-${l}`, "png", readFileSync(file));
}
const pianoDir = join(src, "assets/piano");
const pianoIndex = JSON.parse(readFileSync(join(pianoDir, "index.json"), "utf8"));
const samples = { notes: pianoIndex.notes, urls: {} };
for (const n of pianoIndex.notes) samples.urls[n] = emitHashed("assets/piano", String(n), "mp3", readFileSync(join(pianoDir, `${n}.mp3`)));
const osmdInfo = JSON.parse(readFileSync(join(src, "vendor/osmd/VERSION.json"), "utf8"));
const osmdBuf = readFileSync(join(src, "vendor/osmd", osmdInfo.file));
if (createHash("sha256").update(osmdBuf).digest("hex") !== osmdInfo.sha256) throw new Error("vendored OSMD does not match VERSION.json sha256");
// The bundle points at a source map we do not ship; drop the comment so browsers do not ask for it.
const osmd = emitHashed("assets/vendor", "osmd", "js", Buffer.from(osmdBuf.toString("utf8").replace(/\n?\/\/# sourceMappingURL=\S+\s*$/, "\n")));
// Photos: every width in AVIF and WebP; templates build srcset from these lists.
const photos = {};
for (const id of Object.keys(PHOTOS)) {
	photos[id] = { avif: [], webp: [] };
	for (const w of PHOTO_WIDTHS) {
		for (const ext of ["avif", "webp"]) {
			const file = join(src, "assets/photos", `${id}-${w}.${ext}`);
			if (!existsSync(file)) throw new Error(`missing ${relative(root, file)}: run npm run build:photos`);
			photos[id][ext].push([emitHashed("assets/photos", `${id}-${w}`, ext, readFileSync(file)), w]);
		}
	}
}
const pieces = {};
for (const p of PIECES) {
	const xml = toMusicXml({ title: dicts[defaultLocale].piecesMeta[p.id].title, composer: p.composer, fifths: p.fifths, time: p.time, right: p.right, left: p.left, pickup: p.pickup, rights: "Transcription MIT licence, Nuottitreeni" });
	pieces[p.id] = emitHashed("assets/pieces", p.id, "musicxml", xml);
}

// ---- pages ----------------------------------------------------------------------------
const assets = { css: cssUrl, themeJs, preloadFonts, entries, localeChunks, icons, og, samples, osmd, pieces, photos };
const paths = {};
for (const l of locales) {
	paths[l] = { lesson: {}, rhythm: {}, piece: {} };
	for (const k of ["home", "practice", "freePractice", "phrases", "speed", "explore", "rhythmPractice", "pieces", "myPiece", "log", "devices", "settings", "glossary", "help", "about", "privacy", "accessibility", "licenses", "stream"]) paths[l][k] = site.path(k, l);
	for (const x of PITCH_LESSONS) paths[l].lesson[x.id] = site.path("lesson", l, x.id);
	for (const x of RHYTHM_LESSONS) paths[l].rhythm[x.id] = site.path("rhythm", l, x.id);
	for (const x of PIECES) paths[l].piece[x.id] = site.path("piece", l, x.id);
}
const indexed = [];
let pageCount = 0;
for (const loc of locales) {
	const t = makeT(dicts[loc], enDict);
	const ctx = { loc, dict: dicts[loc], t, site, cfg, assets, dicts, paths };
	const pages = [
		["home", P.homePage(ctx)],
		...PITCH_LESSONS.map((l, i) => ["lesson", P.lessonPage(ctx, l, i)]),
		...RHYTHM_LESSONS.map((r, i) => ["rhythm", P.rhythmPage(ctx, r, i)]),
		["practice", P.practicePage(ctx)],
		["freePractice", P.freePracticePage(ctx)],
		["phrases", P.phrasesPage(ctx)],
		["speed", P.speedPage(ctx)],
		["explore", P.explorePage(ctx)],
		["rhythmPractice", P.rhythmPracticePage(ctx)],
		["pieces", P.piecesPage(ctx)],
		...PIECES.map((p) => ["piece", P.piecePage(ctx, p)]),
		["myPiece", P.myPiecePage(ctx)],
		["log", P.logPage(ctx)],
		["devices", P.devicesPage(ctx)],
		["settings", P.settingsPage(ctx)],
		["glossary", P.glossaryPage(ctx)],
		["help", P.helpPage(ctx)],
		["about", P.aboutPage(ctx)],
		["privacy", P.privacyPage(ctx)],
		["accessibility", P.accessibilityPage(ctx)],
		["licenses", P.licensesPage(ctx)],
		["stream", P.streamPage(ctx)],
	];
	for (const [key, page] of pages) {
		page.key = key;
		page.path = page.twin ? page.twin(loc) : site.path(key, loc);
		if (!page.twin) page.twin = (l) => site.path(key, l);
		if (!INDEXABLE.has(key)) page.index = false;
		emit(`${page.path.slice(1)}index.html`, layout(ctx, page));
		pageCount++;
		if (page.index) indexed.push({ key, path: page.path, twin: page.twin, loc });
	}
}
{
	const loc = defaultLocale;
	const t = makeT(dicts[loc], enDict);
	const ctx = { loc, dict: dicts[loc], t, site, cfg, assets, dicts, paths };
	const page = { key: "notFound", path: "/404.html", title: dicts[loc].notFound.title, description: dicts[loc].notFound.body, entry: "static", index: false, body: P.notFoundBody(dicts, site) };
	emit("404.html", layout(ctx, page));
}

// ---- sitemap, robots, llms.txt, manifest, headers ------------------------------------
if (siteUrl) {
	const urls = indexed
		.map((p) => {
			const alts = locales.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${site.abs(p.twin(l))}"/>`).join("");
			const xdef = `<xhtml:link rel="alternate" hreflang="x-default" href="${site.abs(p.twin(defaultLocale))}"/>`;
			return `<url><loc>${site.abs(p.path)}</loc><lastmod>${lastmod}</lastmod>${alts}${xdef}</url>`;
		})
		.join("\n");
	emit("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
}
emit("robots.txt", cfg.indexable ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n");

function llms(full) {
	const out = [];
	const d = dicts[defaultLocale];
	const abs = (p) => (siteUrl ? site.abs(p) : p);
	out.push(`# ${d.site.name}`, "", `> ${d.site.description}`, "");
	out.push(`Free and open source (MIT): ${cfg.sourceUrl}. Version ${cfg.version}. Author: Markus Silvo (https://markussilvo.fi/).`);
	out.push("No accounts, cookies, analytics or ads. Data stays in the browser unless the user creates a sync code.", "");
	for (const l of locales) {
		const dl = dicts[l];
		out.push(`## ${dl.meta.name}`, "");
		out.push(`- [${dl.home.title}](${abs(site.path("home", l))}): ${dl.site.tagline}`);
		for (const x of PITCH_LESSONS) out.push(`- [${dl.lessons[x.id].title}](${abs(site.path("lesson", l, x.id))}): ${dl.lessons[x.id].description}`);
		for (const x of RHYTHM_LESSONS) out.push(`- [${dl.rhythm[x.id].title}](${abs(site.path("rhythm", l, x.id))}): ${dl.rhythm[x.id].description}`);
		out.push(`- [${dl.pieces.title}](${abs(site.path("pieces", l))}): ${dl.pieces.intro}`);
		out.push(`- [${dl.helpPage.title}](${abs(site.path("help", l))}): ${dl.helpPage.intro}`);
		out.push(`- [${dl.glossaryPage.title}](${abs(site.path("glossary", l))})`);
		out.push(`- [${(legal[l] ?? legal.en).privacy.title}](${abs(site.path("privacy", l))})`, "");
		if (full) {
			for (const [q, a] of dl.help) out.push(`### ${q}`, "", a, "");
			for (const x of PITCH_LESSONS) out.push(`### ${dl.lessons[x.id].title}`, "", ...dl.lessons[x.id].learn.flatMap((p) => [p, ""]));
		}
	}
	return `${out.join("\n").trim()}\n`;
}
emit("llms.txt", llms(false));
emit("llms-full.txt", llms(true));

const dd = dicts[defaultLocale];
emit(
	"manifest.webmanifest",
	`${JSON.stringify(
		{
			id: "/",
			name: dd.site.name,
			short_name: dd.site.name,
			description: dd.site.description,
			lang: defaultLocale,
			dir: "ltr",
			start_url: "/",
			scope: "/",
			display: "standalone",
			background_color: "#000000",
			theme_color: "#000000",
			categories: ["education", "music"],
			prefer_related_applications: false,
			// Long-press menu of the installed app: straight to practice.
			shortcuts: [
				{ name: dd.free.title, url: site.path("freePractice", defaultLocale), icons: [{ src: icons.png192, sizes: "192x192", type: "image/png" }] },
				{ name: dd.phrases.title, url: site.path("phrases", defaultLocale), icons: [{ src: icons.png192, sizes: "192x192", type: "image/png" }] },
				{ name: dd.pieces.title, url: site.path("pieces", defaultLocale), icons: [{ src: icons.png192, sizes: "192x192", type: "image/png" }] },
				{ name: dd.log.title, url: site.path("log", defaultLocale), icons: [{ src: icons.png192, sizes: "192x192", type: "image/png" }] },
			],
			icons: [
				{ src: icons.svg, sizes: "any", type: "image/svg+xml" },
				{ src: icons.png192, sizes: "192x192", type: "image/png" },
				{ src: icons.png512, sizes: "512x512", type: "image/png" },
				{ src: icons.maskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
			],
		},
		null,
		2,
	)}\n`,
);
emit("_headers", headersFile());

// ---- service worker -------------------------------------------------------------------
function listFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)]));
}
const all = listFiles(dist).map((f) => `/${relative(dist, f).replaceAll("\\", "/")}`);
const toUrl = (f) => (f.endsWith("/index.html") ? f.slice(0, -"index.html".length) : f);
const heavy = all.filter((f) => f.startsWith("/assets/piano/") || f.startsWith("/assets/vendor/"));
// Photos: only the smallest AVIF of each is precached; the service worker serves it offline
// when the size the browser asked for was never fetched (sw.js photoFallback).
const smallPhotos = new Set(Object.values(photos).map((p) => p.avif[0][0]));
const skipPhoto = (f) => f.startsWith("/assets/photos/") && !smallPhotos.has(f);
const shell = all.filter((f) => !heavy.includes(f) && !skipPhoto(f) && !["/_headers", "/robots.txt", "/sitemap.xml", "/llms.txt", "/llms-full.txt"].includes(f) && !f.startsWith("/assets/og/")).map(toUrl);
const buildId = hash(JSON.stringify([cfg, all.map((f) => [f, statSync(join(dist, f)).size])]));
const sw = readFileSync(join(src, "sw.js"), "utf8")
	.replace('"__BUILD__"', JSON.stringify(`${cfg.version}-${buildId}`))
	.replace("[] /* __SHELL__ */", JSON.stringify(shell))
	.replace("[] /* __HEAVY__ */", JSON.stringify(heavy));
emit("sw.js", (await esbuild.transform(sw, { minify: true, target: "es2020" })).code);

// ---- budgets --------------------------------------------------------------------------
const gz = (url) => gzipSync(readFileSync(join(dist, url.replace(/\/$/, "/index.html")))).length;
const homeEntry = entries.home;
// The home photo counts at the width a typical phone picks (800w AVIF).
const homePhoto = photos.keys.avif.find(([, w]) => w === 800)[0];
const landing = [`${site.path("home", defaultLocale)}`, cssUrl, themeJs, homeEntry.file, ...homeEntry.preload, localeChunks[defaultLocale], ...preloadFonts, homePhoto];
const binary = (u) => /\.(woff2|avif|webp)$/.test(u);
// Script per page entry (its file and everything it imports statically), so the report can say
// which page is the largest; lazy import() chunks are not counted.
const pageJs = Object.entries(entries).map(([name, e]) => [name, [e.file, ...e.preload].reduce((a, u) => a + gz(u), 0)]).sort((a, b) => b[1] - a[1]);
const report = {
	pages: pageCount,
	landingKb: +(landing.reduce((a, u) => a + (binary(u) ? statSync(join(dist, u)).size : gz(u)), 0) / 1024).toFixed(1),
	cssKb: +(gz(cssUrl) / 1024).toFixed(1),
	maxPageJsKb: +(pageJs[0][1] / 1024).toFixed(1),
	maxPageJs: pageJs[0][0],
	localeKb: Object.fromEntries(Object.entries(localeChunks).map(([l, u]) => [l, +(gz(u) / 1024).toFixed(1)])),
};
console.log(`built ${pageCount} pages for ${locales.join(", ")} (default ${defaultLocale}) into ${relative(process.cwd(), dist) || "."}/`, JSON.stringify(report));
const BUDGET = { landingKb: 120, cssKb: 15, maxPageJsKb: 40 };
const over = Object.entries(BUDGET).filter(([k, v]) => report[k] > v);
if (over.length && env.NT_SKIP_BUDGET !== "1") {
	console.error(`size budget exceeded: ${over.map(([k, v]) => `${k} ${report[k]} > ${v}`).join(", ")}`);
	process.exit(1);
}
