#!/usr/bin/env node
// Screenshots for design review: builds the test site (unless --no-build), starts wrangler dev
// and saves full-page PNGs of the given paths at each width and theme.
//
// Usage: node tests/browser/shots.mjs [--no-build] [--widths 320,1280] [--themes dark,light]
//        [--settings '{"fallingNotes":true}'] [path ...]
// --settings: JSON merged into the app settings (nt.v1.settings) before every page loads.
// Default paths: /, /en/, a lesson, the pieces page, a piece, help, settings.
// Output: tests/browser/artifacts/review/<path>-<theme>-<width>.png
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import fi from "../../src/content/locales/fi.js";
import { fakeDevices } from "./lib/fakes.js";
import { ROOT, build, startServer } from "./lib/server.mjs";

const require = createRequire(new URL("./package.json", import.meta.url));
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const list = (name, fallback) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1].split(",") : fallback;
};
const widths = list("--widths", ["320", "1280"]).map(Number);
const themes = list("--themes", ["dark", "light"]);
const valueArgs = new Set(["--widths", "--themes", "--settings"]);
const settingsArg = args.includes("--settings") ? JSON.parse(args[args.indexOf("--settings") + 1]) : null;
const paths = args.filter((a, i) => a.startsWith("/") && !valueArgs.has(args[i - 1]));
const targets = paths.length
	? paths
	: ["/", "/en/", `/${fi.slugs.pages.lessons}/${fi.slugs.lessons["treble-c4-g4"]}/`, `/${fi.slugs.pages.pieces}/`, `/${fi.slugs.pages.pieces}/${fi.slugs.pieces["ukko-nooa"]}/`, `/${fi.slugs.pages.help}/`, `/${fi.slugs.pages.settings}/`];
const out = join(ROOT, "tests/browser/artifacts/review");
mkdirSync(out, { recursive: true });

if (!args.includes("--no-build")) build();
const server = await startServer({ port: 8799 });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
try {
	for (const theme of themes) {
		for (const width of widths) {
			const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, locale: "fi-FI", reducedMotion: "reduce" });
			await context.addInitScript(fakeDevices, "prompt");
			if (settingsArg) await context.addInitScript((s) => localStorage.setItem("nt.v1.settings", JSON.stringify(s)), settingsArg);
			const page = await context.newPage();
			for (const p of targets) {
				await page.goto(server.base + p, { waitUntil: "networkidle" });
				const file = join(out, `${p.replace(/[^a-z0-9]+/gi, "_")}-${theme}-${width}.png`);
				await page.screenshot({ path: file, fullPage: true });
				console.log(file.slice(ROOT.length));
			}
			await context.close();
		}
	}
} finally {
	await browser.close();
	server.stop();
}
