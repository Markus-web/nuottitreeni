#!/usr/bin/env node
// Browser test suite: end-to-end flows, the WCAG 2.2 AAA matrix, design checks, SEO crawl,
// Lighthouse budgets and the template (deploy-button) build. Exit 1 on any failure.
//
// Usage: node tests/browser/run.mjs [--only flows,aaa,seo,lighthouse,template] [--no-build]
//        [--grep text]   (only flows and AAA pages whose name contains the text)
// AAA paths ending in #note-colors run with the note colours setting on.
// Needs: npm ci --prefix tests/browser --ignore-scripts, and Chromium (CHROMIUM_PATH, default
// /usr/bin/chromium). Reports and screenshots: tests/browser/artifacts/.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PIECES, PITCH_LESSONS, RHYTHM_LESSONS } from "../../src/content/catalog.js";
import en from "../../src/content/locales/en.js";
import fi from "../../src/content/locales/fi.js";
import { animations, axe, designSlop, focusRings, presentation, reflow, skipLink, structure, targets, textSpacing } from "./lib/checks.mjs";
import { fakeDevices } from "./lib/fakes.js";
import { ROOT, build, startServer } from "./lib/server.mjs";
import { flows } from "./flows.mjs";
import { checkSeo } from "../../scripts/check-seo.mjs";

const require = createRequire(new URL("./package.json", import.meta.url));
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only"));
const only = onlyArg ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : args[args.indexOf(onlyArg) + 1]).split(",") : ["flows", "aaa", "seo", "lighthouse", "template"];
const grep = args.includes("--grep") ? args[args.indexOf("--grep") + 1] : "";
const artifacts = join(ROOT, "tests/browser/artifacts");
rmSync(artifacts, { recursive: true, force: true });
mkdirSync(join(artifacts, "shots"), { recursive: true });
const CHROMIUM = process.env.CHROMIUM_PATH || "/usr/bin/chromium";

const results = [];
function record(group, name, problems, extra = {}) {
	const ok = problems.length === 0;
	results.push({ group, name, ok, problems, ...extra });
	console.log(`${ok ? "ok  " : "FAIL"} ${group}: ${name}${ok ? "" : `\n     ${problems.slice(0, 6).join("\n     ")}`}`);
}

if (!args.includes("--no-build")) build();
const server = await startServer();
const browser = await chromium.launch({ executablePath: CHROMIUM });
const contexts = [];

async function open(path, { mode = "prompt", theme = "dark", width = 1280, height = 900, locale = "fi-FI", settings = null, reduced = true } = {}) {
	const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, locale, reducedMotion: reduced ? "reduce" : "no-preference", acceptDownloads: true });
	contexts.push(context);
	await context.addInitScript(fakeDevices, mode);
	if (settings) await context.addInitScript((s) => localStorage.setItem("nt.v1.settings", JSON.stringify(s)), settings);
	const page = await context.newPage();
	page.errors = [];
	page.on("console", (m) => m.type() === "error" && page.errors.push(m.text().slice(0, 200)));
	page.on("pageerror", (e) => page.errors.push(`pageerror ${e.message.slice(0, 200)}`));
	await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP ${e.violatedDirective} ${e.blockedURI}`)));
	await page.goto(server.base + path, { waitUntil: "networkidle" });
	return page;
}

async function closeContexts() {
	while (contexts.length) await contexts.pop().close().catch(() => {});
}

try {
	// ---- flows ------------------------------------------------------------------------
	if (only.includes("flows")) {
		for (const [name, fn] of Object.entries(flows(open))) {
			if (!name.includes(grep)) continue;
			try {
				await fn({ base: server.base });
				record("flow", name, []);
			} catch (e) {
				record("flow", name, [String(e?.message || e).split("\n")[0]]);
			}
			await closeContexts();
		}
	}

	// ---- WCAG 2.2 AAA + design matrix ------------------------------------------------------
	if (only.includes("aaa")) {
		const fiPaths = [
			"/",
			...PITCH_LESSONS.map((l) => `/oppitunnit/${fi.slugs.lessons[l.id]}/`),
			...RHYTHM_LESSONS.map((r) => `/rytmi/${fi.slugs.rhythm[r.id]}/`),
			"/harjoitus/?l=treble-c4-g4&m=single",
			"/harjoitus/?l=keys&m=single",
			"/harjoitus/?l=treble-c4-c5&m=name",
			"/harjoitus/?l=treble-c4-c5&m=name#note-colors",
			"/vapaa-harjoitus/",
			"/vapaa-harjoitus/?c=grand&lo=F2&hi=G5&k=-2&a=1&m=name",
			"/rytmiharjoitus/?l=rhythm-values",
			"/rytmiharjoitus/?l=rhythm-play",
			"/kappaleet/",
			`/kappaleet/${fi.slugs.pieces["ukko-nooa"]}/`,
			`/kappaleet/${fi.slugs.pieces["chopin-preludi"]}/`,
			`/kappaleet/${fi.slugs.pieces["ukko-nooa"]}/#note-colors`,
			"/paivakirja/",
			"/laitteet/",
			"/asetukset/",
			"/sanasto/",
			"/ohje/",
			"/tietoa/",
			"/tietosuoja/",
			"/saavutettavuus/",
			"/lisenssit/",
			"/404.html",
		];
		const enPaths = ["/en/", `/en/lessons/${en.slugs.lessons["treble-c4-g4"]}/`, "/en/practice/?l=treble-c4-g4&m=single", "/en/free-practice/", "/en/settings/", "/en/pieces/", "/en/help/"];
		const combos = [
			{ theme: "dark", width: 1280, deep: true },
			{ theme: "light", width: 1280, deep: false },
			{ theme: "dark", width: 320, deep: false },
			{ theme: "light", width: 320, deep: true },
		];
		for (const path of [...fiPaths, ...enPaths].filter((p) => p.includes(grep))) {
			for (const c of combos) {
				const settings = path.endsWith("#note-colors") ? { noteColors: true, fallingNotes: true } : null;
				const page = await open(path, { theme: c.theme, width: c.width, height: 800, locale: path.startsWith("/en/") ? "en-GB" : "fi-FI", mode: "prompt", settings });
				if (path.includes("kappaleet/") && path.length > 12) await page.waitForSelector("#score svg", { timeout: 15000 }).catch(() => {});
				const problems = [];
				for (const v of await axe(page)) problems.push(`axe ${v}`);
				for (const p of await reflow(page)) problems.push(p);
				for (const p of await designSlop(page)) problems.push(`slop ${p}`);
				for (const p of await presentation(page)) problems.push(`1.4.8 ${p}`);
				for (const p of await animations(page)) problems.push(`2.3.3 ${p}`);
				for (const p of await structure(page)) problems.push(p);
				for (const p of await targets(page)) problems.push(`2.5.5 ${p}`);
				if (c.deep) {
					for (const p of await textSpacing(page)) problems.push(`1.4.12 ${p}`);
					for (const p of await skipLink(page)) problems.push(`2.4.1 ${p}`);
					for (const p of await focusRings(page)) problems.push(`2.4.13 ${p}`);
				}
				for (const e of page.errors) problems.push(`console ${e}`);
				const shot = `${path.replace(/[^a-z0-9]+/gi, "_")}-${c.theme}-${c.width}.png`;
				await page.screenshot({ path: join(artifacts, "shots", shot), fullPage: true });
				record("aaa", `${path} ${c.theme} ${c.width}`, problems, { shot });
				await closeContexts();
			}
		}
		// Scripted states: a missed note (feedback, marks) and forced colours.
		const page = await open("/harjoitus/?l=treble-c4-g4&m=single", { mode: "granted" });
		await page.waitForSelector("section.question[data-key]");
		await page.evaluate(() => window.__fakeMidi.press(21));
		await page.waitForSelector(".feedback .bad");
		const missProblems = [...(await axe(page)).map((v) => `axe ${v}`), ...(await designSlop(page)).map((p) => `slop ${p}`)];
		await page.emulateMedia({ forcedColors: "active" });
		missProblems.push(...(await axe(page)).map((v) => `axe forced-colors ${v}`));
		const mark = await page.locator(".key.is-target .key-mark").first().evaluate((el) => getComputedStyle(el, "::before").content);
		if (!mark.includes("✓")) missProblems.push(`target marker missing (${mark})`);
		await page.screenshot({ path: join(artifacts, "shots", "drill-miss-forced-colors.png"), fullPage: true });
		record("aaa", "drill after a miss, incl. forced colours", missProblems);
		await closeContexts();
	}

	// ---- SEO crawl of the build ------------------------------------------------------------
	if (only.includes("seo")) {
		const problems = checkSeo(join(ROOT, "dist"), { siteUrl: "https://piano.example" });
		record("seo", "dist crawl (titles, descriptions, canonical, hreflang, JSON-LD, links, sitemap, robots, llms.txt)", problems);
	}

	// ---- Lighthouse budgets ------------------------------------------------------------------
	if (only.includes("lighthouse")) {
		const { default: lighthouse } = await import(require.resolve("lighthouse"));
		const { launch } = require("chrome-launcher");
		const chrome = await launch({ chromePath: CHROMIUM, chromeFlags: ["--headless=new", "--no-sandbox"] });
		const budgetPages = ["/", "/en/", "/oppitunnit/ensimmaiset-nuotit/", "/ohje/", `/kappaleet/${fi.slugs.pieces["ukko-nooa"]}/`];
		try {
			for (const formFactor of ["mobile", "desktop"]) {
				for (const p of budgetPages) {
					const config = formFactor === "desktop" ? (await import(require.resolve("lighthouse/core/config/desktop-config.js"))).default : undefined;
					// A run that fails to load (score null, runtimeError such as NO_FCP on a busy CI
					// machine) is repeated once; a real budget miss is not retried.
					const run = () => lighthouse(server.base + p, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] }, config);
					let r = await run();
					if (r.lhr.runtimeError || r.lhr.categories.performance.score == null) {
						console.log(`retry lighthouse ${formFactor} ${p}: ${r.lhr.runtimeError?.code ?? "no performance score"}`);
						r = await run();
					}
					const cat = r.lhr.categories;
					const a = r.lhr.audits;
					const scores = Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, Math.round(v.score * 100)]));
					const problems = [];
					if (r.lhr.runtimeError) problems.push(`lighthouse runtime error ${r.lhr.runtimeError.code}: ${r.lhr.runtimeError.message}`);
					// SEO on localhost: canonical points to the production host, so "canonical" and
					// "is-crawlable" are judged by the SEO crawl above instead.
					if (scores.performance < 95) problems.push(`performance ${scores.performance} < 95`);
					if (scores.accessibility < 100) problems.push(`accessibility ${scores.accessibility}`);
					if (scores["best-practices"] < 100) problems.push(`best-practices ${scores["best-practices"]}: ${Object.values(a).filter((x) => x.score === 0 && cat["best-practices"].auditRefs.some((ref) => ref.id === x.id)).map((x) => x.id).join(", ")}`);
					const seoFails = cat.seo.auditRefs.filter((ref) => ref.weight > 0 && a[ref.id].score === 0 && !["canonical", "is-crawlable"].includes(ref.id)).map((ref) => ref.id);
					if (seoFails.length) problems.push(`seo audits failing: ${seoFails.join(", ")}`);
					const lcp = a["largest-contentful-paint"].numericValue;
					const cls = a["cumulative-layout-shift"].numericValue;
					const tbt = a["total-blocking-time"].numericValue;
					if (lcp > 1800) problems.push(`LCP ${Math.round(lcp)} ms > 1800`);
					if (cls > 0.02) problems.push(`CLS ${cls.toFixed(3)} > 0.02`);
					if (tbt > 100) problems.push(`TBT ${Math.round(tbt)} ms > 100`);
					record("lighthouse", `${formFactor} ${p} ${JSON.stringify(scores)}`, problems, { scores, lcp, cls, tbt });
				}
			}
		} finally {
			await chrome.kill();
		}
	}
} finally {
	await closeContexts();
	await browser.close();
	server.stop();
}

// ---- template build (deploy-button defaults) ------------------------------------------------
if (only.includes("template")) {
	build({ template: true });
	const srv = await startServer({ port: 8798 });
	const b2 = await chromium.launch({ executablePath: CHROMIUM });
	try {
		const ctx = await b2.newContext();
		const page = await ctx.newPage();
		await page.goto(`${srv.base}/privacy/`, { waitUntil: "networkidle" });
		const problems = [];
		if ((await page.getAttribute('meta[name="robots"]', "content")) !== "noindex, follow") problems.push("template build must be noindex");
		if (!(await (await fetch(`${srv.base}/robots.txt`)).text()).includes("Disallow: /")) problems.push("template robots.txt must disallow");
		if ((await page.locator("html").getAttribute("lang")) !== "en") problems.push("template default locale should be en");
		record("template", "deploy-button defaults: English first, noindex, operator from /api/config", problems);
	} finally {
		await b2.close();
		srv.stop();
	}
	build();
}

const failed = results.filter((r) => !r.ok);
writeFileSync(join(artifacts, "report.json"), `${JSON.stringify({ when: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2)}\n`);
console.log(`\n${results.length - failed.length}/${results.length} passed. Report: tests/browser/artifacts/report.json`);
process.exit(failed.length ? 1 : 0);
