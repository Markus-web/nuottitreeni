#!/usr/bin/env node
// Proves a deployed instance works: TLS, security and cache headers on a page, an asset,
// sw.js and the API, /api/health version, /api/config, robots/sitemap/llms/manifest/404,
// hreflang, and a sync round trip that deletes its own record. With --browser it also runs
// axe (WCAG 2.2 AAA tags) and Lighthouse on / and the second locale, using the pinned
// browser-test packages (npm ci --prefix tests/browser --ignore-scripts).
//
// Usage: node scripts/prove-live.mjs --base https://piano.example.org [--browser] [--wait 300]
//   --wait N   keep retrying the first request for up to N seconds (new custom domain, first
//              certificate). Default 300.
//   --no-sync  skip the sync round trip (instances with SYNC_ENABLED=false skip it anyway)
// Exit code 1 when any check fails. Needs Node 22; --browser also needs Chromium
// (CHROMIUM_PATH, default /usr/bin/chromium).
import { createRequire } from "node:module";
import pkg from "../package.json" with { type: "json" };
import { emptyProgress, recordRound } from "../src/core/progress.js";
import { CSP, SECURITY_HEADERS } from "../worker/headers.js";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(name);
	return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const base = (opt("--base", process.env.NT_SITE_URL) || "").replace(/\/+$/, "");
// http only for a local wrangler dev check (npm run dev); real instances must be https.
if (!/^https:\/\/[^/]+$/.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) {
	console.error("usage: prove-live.mjs --base https://host [--browser] [--wait 300] [--no-sync]");
	process.exit(2);
}
const waitSec = Number(opt("--wait", "300"));

let failed = 0;
function check(name, problems) {
	const list = (Array.isArray(problems) ? problems : [problems]).filter(Boolean);
	console.log(`${list.length ? "FAIL" : "ok  "} ${name}${list.length ? `\n     ${list.join("\n     ")}` : ""}`);
	if (list.length) failed++;
}
const get = (path, init) => fetch(base + path, { redirect: "manual", ...init });

// Some zones add their own security headers (Cloudflare managed transforms) that replace
// ours. These are accepted when they are at least as strict; anything else must match exactly.
const EQUIVALENT = {
	"Strict-Transport-Security": (v) => /max-age=(\d+)/.test(v ?? "") && Number(/max-age=(\d+)/.exec(v)[1]) >= 31536000 && /includeSubDomains/i.test(v),
	"Referrer-Policy": (v) => ["no-referrer", "same-origin"].includes(v),
	// CSP frame-ancestors 'none' already forbids framing; X-Frame-Options is the fallback.
	"X-Frame-Options": (v) => ["DENY", "SAMEORIGIN"].includes(v),
};
const notes = new Set();

function headerProblems(res, extra = {}) {
	const out = [];
	for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) {
		const got = res.headers.get(k);
		if (got === v) continue;
		if (EQUIVALENT[k]?.(got)) notes.add(`${k}: "${got}" (zone setting, accepted as equivalent)`);
		else out.push(`${k}: ${got === null ? "missing" : `"${got}"`}`);
	}
	return out;
}

// ---- reachability (retry while DNS and the certificate settle) ---------------------------
const started = Date.now();
let home;
for (;;) {
	try {
		home = await get("/");
		if (home.status === 200) break;
		throw new Error(`HTTP ${home.status}`);
	} catch (e) {
		if ((Date.now() - started) / 1000 > waitSec) {
			check(`reach ${base}/ over TLS`, `${e.cause?.code || e.message}`);
			process.exit(1);
		}
		await new Promise((r) => setTimeout(r, 10000));
	}
}
check(`reach ${base}/ over TLS`, []);
const homeHtml = await home.text();

// ---- pages and headers ----------------------------------------------------------------------
check("HTML: security headers", headerProblems(home));
check("HTML: not cached as immutable, no-transform (no zone script injection)", /immutable/.test(home.headers.get("cache-control") || "") || !/no-transform/.test(home.headers.get("cache-control") || "") ? `cache-control ${home.headers.get("cache-control")}` : []);
// Cloudflare zone features inject scripts only for browser user agents, so ask like a browser.
const asBrowser = await (await get("/", { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36", Accept: "text/html" } })).text();
check("HTML for a browser is unmodified (no injected analytics or Zaraz)", /cloudflareinsights|\/cdn-cgi\/zaraz|rocket-loader/.test(asBrowser) ? "the zone injects a script: keep Cache-Control no-transform on pages" : []);
const lang = /<html lang="([a-z]{2})">/.exec(homeHtml)?.[1];
check("HTML: lang and title", [!lang && "no <html lang>", !/<title>[^<]{5,}<\/title>/.test(homeHtml) && "no title"]);
const alternates = [...homeHtml.matchAll(/<link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)">/g)];
check("HTML: hreflang alternates and x-default", [alternates.length < 2 && `only ${alternates.length} alternates`, !alternates.some((m) => m[1] === "x-default") && "no x-default", alternates.some((m) => !m[2].startsWith(`${base}/`)) && "alternate on another host"]);
const cssPath = /<link rel="stylesheet" href="(\/assets\/css\/[^"]+)">/.exec(homeHtml)?.[1];
if (cssPath) {
	const css = await get(cssPath);
	check(`asset ${cssPath}: 200, immutable, compressible, security headers`, [css.status !== 200 && `HTTP ${css.status}`, (!/immutable/.test(css.headers.get("cache-control") || "") || /no-transform/.test(css.headers.get("cache-control") || "")) && `cache-control ${css.headers.get("cache-control")}`, ...headerProblems(css)]);
} else check("asset: stylesheet link in HTML", "not found");
const sw = await get("/sw.js");
check("sw.js: 200, no-cache", [sw.status !== 200 && `HTTP ${sw.status}`, sw.headers.get("cache-control") !== "no-cache" && `cache-control ${sw.headers.get("cache-control")}`]);
const second = alternates.map((m) => m[2]).find((u) => u !== `${base}/` && !u.endsWith("/x-default"));

// ---- API ------------------------------------------------------------------------------------
const health = await get("/api/health");
const healthBody = await health.json().catch(() => ({}));
check(`/api/health: ok, version ${pkg.version}`, [health.status !== 200 && `HTTP ${health.status}`, healthBody.ok !== true && "ok is not true", healthBody.version !== pkg.version && `version ${healthBody.version}`, ...headerProblems(health)]);
check("/api/health: not cached", (health.headers.get("cache-control") || "").includes("no-store") ? [] : `cache-control ${health.headers.get("cache-control")}`);
const config = await get("/api/config");
const conf = await config.json().catch(() => null);
check("/api/config: operator and sync flag", [config.status !== 200 && `HTTP ${config.status}`, !conf && "not JSON", conf && typeof conf.syncEnabled !== "boolean" && "syncEnabled missing", conf && !conf.operatorName && "operatorName empty (set OPERATOR_NAME or NT_OPERATOR_NAME)"]);
const foreign = await get("/api/sync", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
check("/api/sync: foreign Origin rejected (403)", foreign.status === 403 ? [] : `HTTP ${foreign.status}`);

if (!args.includes("--no-sync") && conf?.syncEnabled) {
	const problems = [];
	let doc = emptyProgress();
	doc = recordRound(doc, "prooflive01", { kind: "lesson", id: "keys", mode: "single", accuracy: 100, results: [{ key: "C", ok: true, ms: 900 }] }, Date.now());
	const json = (body) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
	const created = await get("/api/sync", { method: "POST", ...json({ data: doc }) });
	const c = await created.json().catch(() => ({}));
	if (created.status !== 201 || !c.code) problems.push(`create: HTTP ${created.status} ${JSON.stringify(c)}`);
	else {
		const code = encodeURIComponent(c.code);
		const read = await get(`/api/sync/${code}`);
		const r = await read.json().catch(() => ({}));
		if (read.status !== 200 || r.rev !== 1) problems.push(`read: HTTP ${read.status} rev ${r.rev}`);
		const put = await get(`/api/sync/${code}`, { method: "PUT", ...json({ baseRev: 1, data: doc }) });
		if (put.status !== 200) problems.push(`update: HTTP ${put.status}`);
		const stale = await get(`/api/sync/${code}`, { method: "PUT", ...json({ baseRev: 1, data: doc }) });
		if (stale.status !== 409) problems.push(`stale update: HTTP ${stale.status}, expected 409`);
		const del = await get(`/api/sync/${code}`, { method: "DELETE" });
		if (del.status !== 204) problems.push(`delete: HTTP ${del.status}`);
		const gone = await get(`/api/sync/${code}`);
		if (gone.status !== 404) problems.push(`after delete: HTTP ${gone.status}, expected 404`);
	}
	check("sync round trip (create, read, update, conflict, delete)", problems);
} else console.log("skip sync round trip");

// ---- crawl files --------------------------------------------------------------------------
for (const [path, test] of [
	["/robots.txt", (t) => /User-agent: \*/.test(t)],
	["/sitemap.xml", (t) => t.includes("<urlset") && t.includes(`<loc>${base}/</loc>`)],
	["/llms.txt", (t) => t.startsWith("# ")],
	["/manifest.webmanifest", (t) => JSON.parse(t).start_url === "/"],
]) {
	const res = await get(path);
	const text = await res.text();
	let ok = false;
	try {
		ok = res.status === 200 && test(text);
	} catch {
		ok = false;
	}
	check(`${path}`, ok ? [] : `HTTP ${res.status}, unexpected content`);
}
const missing = await get("/no-such-page-for-prove-live/");
check("unknown page: 404 with the not-found page", [missing.status !== 404 && `HTTP ${missing.status}`, !(await missing.text()).includes("<h1") && "no heading"]);
check("CSP in headers equals worker/headers.js", home.headers.get("content-security-policy") === CSP ? [] : "differs");

// ---- browser: axe AAA and Lighthouse --------------------------------------------------------
if (args.includes("--browser")) {
	const require = createRequire(new URL("../tests/browser/package.json", import.meta.url));
	const { chromium } = require("playwright-core");
	const { axe } = await import("../tests/browser/lib/checks.mjs");
	const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
	const pages = [`${base}/`, second].filter(Boolean);
	const browser = await chromium.launch({ executablePath });
	try {
		for (const url of pages) {
			for (const theme of ["dark", "light"]) {
				const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1280, height: 900 } });
				const page = await context.newPage();
				const errors = [];
				page.on("pageerror", (e) => errors.push(e.message));
				page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
				await page.goto(url, { waitUntil: "networkidle" });
				check(`axe AAA ${theme} ${url}`, [...(await axe(page)), ...errors]);
				await context.close();
			}
		}
	} finally {
		await browser.close();
	}
	const { default: lighthouse } = await import(require.resolve("lighthouse"));
	const { launch } = require("chrome-launcher");
	const chrome = await launch({ chromePath: executablePath, chromeFlags: ["--headless=new", "--no-sandbox"] });
	try {
		for (const url of pages) {
			const r = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] });
			const scores = Object.fromEntries(Object.entries(r.lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
			check(`Lighthouse mobile ${url} ${JSON.stringify(scores)}`, [scores.performance < 90 && `performance ${scores.performance}`, scores.accessibility < 100 && `accessibility ${scores.accessibility}`, scores["best-practices"] < 100 && `best-practices ${scores["best-practices"]}`, scores.seo < 100 && `seo ${scores.seo}`]);
		}
	} finally {
		await chrome.kill();
	}
}

for (const note of notes) console.log(`note ${note}`);
console.log(failed ? `\n${failed} check(s) failed for ${base}` : `\nall checks passed for ${base}`);
process.exit(failed ? 1 : 0);
