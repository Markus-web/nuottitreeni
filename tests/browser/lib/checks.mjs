// Accessibility (WCAG 2.2 AAA) and design checks run on a live page. Each returns a list of
// problems (empty = pass). Written for this app; criteria references in comments.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** axe-core with AAA tags; returns violations as short strings. */
export async function axe(page) {
	// Evaluated through the DevTools protocol, so the page keeps its strict CSP during the scan.
	if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(AXE_SOURCE);
	const result = await page.evaluate(async (tags) => {
		const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
		return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
	}, AXE_TAGS);
	return result;
}

/** 2.5.5 Target Size (Enhanced): 44 x 44. Inline links in text and black keys (24 px, essential) are exempt. */
export async function targets(page) {
	return page.evaluate(() => {
		const out = [];
		for (const node of document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex]:not([tabindex='-1'])")) {
			if (node.closest("[hidden]") || node.classList.contains("skip-link") || node.matches(".visually-hidden")) continue;
			let target = node;
			if (node.matches("input[type=checkbox], input[type=radio]")) target = node.closest("label") || node;
			const r = target.getBoundingClientRect();
			const cs = getComputedStyle(target);
			if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none") continue;
			if (node.tagName === "A" && getComputedStyle(node).display === "inline") {
				const block = node.closest("p, li, dd, td, figcaption");
				if (block && block.textContent.trim().length > node.textContent.trim().length + 10) continue;
			}
			const min = node.classList.contains("key-black") ? 24 : 44;
			if (r.width < min - 0.5 || r.height < min - 0.5) out.push(`${node.tagName.toLowerCase()}.${(node.className || "").toString().split(" ")[0]} "${(node.getAttribute("aria-label") || node.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
		}
		return [...new Set(out)];
	});
}

/** 2.4.7 / 2.4.13: every tab stop shows a focus indicator at least 2px with 3:1 against the background. */
export async function focusRings(page, maxStops = 60) {
	await page.evaluate(() => {
		window.scrollTo(0, 0);
		const probe = document.createElement("span");
		probe.tabIndex = -1;
		document.body.prepend(probe);
		probe.focus();
		probe.remove();
	});
	const problems = [];
	const seen = new Set();
	for (let i = 0; i < maxStops; i++) {
		await page.keyboard.press("Tab");
		const info = await page.evaluate(() => {
			const el = document.activeElement;
			if (!el || el === document.body) return null;
			const id = el.outerHTML.slice(0, 80);
			const cs = getComputedStyle(el);
			const lum = (c) => {
				const m = c.match(/[\d.]+/g);
				if (!m) return null;
				const [r, g, b] = m.slice(0, 3).map(Number).map((v) => {
					v /= 255;
					return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
				});
				return 0.2126 * r + 0.7152 * g + 0.0722 * b;
			};
			const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
			let bgEl = el.parentElement;
			let bg = "rgb(0, 0, 0)";
			while (bgEl) {
				const c = getComputedStyle(bgEl).backgroundColor;
				if (c && !c.startsWith("rgba(0, 0, 0, 0)") && c !== "transparent") {
					bg = c;
					break;
				}
				bgEl = bgEl.parentElement;
			}
			if (!bgEl) bg = getComputedStyle(document.body).backgroundColor;
			const outlineW = cs.outlineStyle === "none" ? 0 : parseFloat(cs.outlineWidth);
			const shadow = cs.boxShadow !== "none" ? cs.boxShadow : "";
			const shadowColor = shadow.match(/rgba?\([^)]+\)/)?.[0];
			const shadowSpread = shadow ? Math.max(...(shadow.match(/(-?[\d.]+)px/g) || ["0px"]).map((v) => parseFloat(v))) : 0;
			const bgL = lum(bg);
			const okOutline = outlineW >= 2 && lum(cs.outlineColor) != null && ratio(lum(cs.outlineColor), bgL) >= 3;
			const okShadow = shadowSpread >= 2 && shadowColor && ratio(lum(shadowColor), bgL) >= 3;
			return { id, ok: okOutline || okShadow, desc: `${el.tagName.toLowerCase()} outline ${cs.outlineWidth} ${cs.outlineColor} shadow ${shadow.slice(0, 40)} bg ${bg}` };
		});
		if (!info) continue;
		if (seen.has(info.id)) break;
		seen.add(info.id);
		if (!info.ok) problems.push(info.desc);
	}
	return problems;
}

/** 2.4.1: the first Tab stop is the skip link, and it moves focus to main. */
export async function skipLink(page) {
	await page.evaluate(() => {
		window.scrollTo(0, 0);
		const probe = document.createElement("span");
		probe.tabIndex = -1;
		document.body.prepend(probe);
		probe.focus();
		probe.remove();
	});
	await page.keyboard.press("Tab");
	const first = await page.evaluate(() => document.activeElement?.classList.contains("skip-link"));
	if (!first) return ["first tab stop is not the skip link"];
	await page.keyboard.press("Enter");
	const inMain = await page.evaluate(() => document.activeElement?.id === "main" || Boolean(document.activeElement?.closest("main")));
	return inMain ? [] : ["skip link does not move focus to main"];
}

/** 1.3.1 / 2.4.6 / 2.4.10: one h1, no skipped levels; 2.4.2 title; 3.1.1 / 3.1.2 language. */
export async function structure(page) {
	return page.evaluate(() => {
		const out = [];
		const hs = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter((h) => h.getClientRects().length && !h.closest("[hidden]"));
		const h1 = hs.filter((h) => h.tagName === "H1");
		if (h1.length !== 1) out.push(`h1 count ${h1.length}`);
		let prev = 0;
		for (const h of hs) {
			const lvl = Number(h.tagName[1]);
			if (prev && lvl > prev + 1) out.push(`heading skip h${prev} -> h${lvl} "${h.textContent.trim().slice(0, 30)}"`);
			prev = lvl;
		}
		if (!document.title.trim()) out.push("empty title");
		if (!["fi", "en"].includes(document.documentElement.lang)) out.push(`html lang ${document.documentElement.lang}`);
		for (const a of document.querySelectorAll("[data-lang-link]")) if (!a.getAttribute("lang")) out.push("language link without lang");
		return out;
	});
}

/** 1.4.10 Reflow: no page-level horizontal scrolling. */
export async function reflow(page) {
	const px = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	return px > 1 ? [`horizontal overflow ${px}px`] : [];
}

/** 1.4.12 Text Spacing: no clipped text with WCAG spacing overrides. */
export async function textSpacing(page) {
	// Constructable stylesheet (CSSOM), allowed under the page's style-src 'self'.
	await page.evaluate(() => {
		const sheet = new CSSStyleSheet();
		sheet.replaceSync("* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }");
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
		window.__ntSpacing = sheet;
	});
	const out = await page.evaluate(() => {
		const res = [];
		for (const el of document.querySelectorAll("body *")) {
			const cs = getComputedStyle(el);
			if (!el.textContent.trim() || el.children.length > 3) continue;
			const clipX = (cs.overflowX === "hidden" || cs.overflow === "hidden") && el.scrollWidth > el.clientWidth + 1;
			const clipY = (cs.overflowY === "hidden" || cs.overflow === "hidden") && el.scrollHeight > el.clientHeight + 1;
			if ((clipX || clipY) && !el.classList.contains("visually-hidden")) res.push(`${el.tagName.toLowerCase()}.${el.className} clipped`);
		}
		return res;
	});
	await page.evaluate(() => {
		document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== window.__ntSpacing);
	});
	return out;
}

/** 1.4.8 Visual Presentation: line height, paragraph spacing, line length, no justified text. */
export async function presentation(page) {
	return page.evaluate(() => {
		const out = [];
		const zero = document.createElement("span");
		zero.textContent = "0";
		zero.style.visibility = "hidden";
		zero.style.position = "absolute";
		for (const p of document.querySelectorAll("main p")) {
			if (!p.getClientRects().length || p.textContent.trim().length < 40) continue;
			const cs = getComputedStyle(p);
			const fs = parseFloat(cs.fontSize);
			const lh = cs.lineHeight === "normal" ? fs * 1.2 : parseFloat(cs.lineHeight);
			if (lh / fs < 1.5) out.push(`line-height ${(lh / fs).toFixed(2)} "${p.textContent.trim().slice(0, 30)}"`);
			if (cs.textAlign === "justify") out.push("justified text");
			p.append(zero);
			const ch = zero.getBoundingClientRect().width;
			zero.remove();
			if (ch && p.getBoundingClientRect().width / ch > 80.5) out.push(`line length ${Math.round(p.getBoundingClientRect().width / ch)}ch`);
		}
		return out;
	});
}

/** 2.3.3 and design rule: nothing animates on its own. */
export async function animations(page) {
	const n = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
	return n ? [`${n} running animations`] : [];
}

/** Visual tells of template design (catalogue: https://impeccable.style/slop/) that apply to this app, and broken text such as "null"; CONTRIBUTING.md, Accessibility. */
export async function designSlop(page) {
	return page.evaluate(() => {
		const out = [];
		const bodySize = parseFloat(getComputedStyle(document.body).fontSize);
		for (const el of document.querySelectorAll("body *")) {
			if (!el.getClientRects().length || el.closest("[aria-hidden=true]")) continue;
			const cs = getComputedStyle(el);
			const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
			if (ownText) {
				let size = parseFloat(cs.fontSize);
				if (el instanceof SVGElement && el.getScreenCTM) size *= el.getScreenCTM().a;
				if (size < 11.5 && !el.closest(".visually-hidden")) out.push(`tiny text ${size.toFixed(1)}px "${el.textContent.trim().slice(0, 20)}"`);
				if (parseFloat(cs.letterSpacing) < -0.03 * parseFloat(cs.fontSize)) out.push(`crushed tracking "${el.textContent.trim().slice(0, 20)}"`);
			}
			if (cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text") out.push("gradient text");
			if (cs.backdropFilter && cs.backdropFilter !== "none") out.push("glass (backdrop-filter)");
			const bl = parseFloat(cs.borderLeftWidth);
			if (bl >= 3 && bl > parseFloat(cs.borderTopWidth) + 1 && bl > parseFloat(cs.borderRightWidth) + 1) out.push(`side stripe ${el.tagName.toLowerCase()}.${el.className}`);
			if (cs.animationIterationCount === "infinite" && cs.animationName !== "none") out.push("infinite animation");
			if (/^H[1-3]$/.test(el.tagName) && parseFloat(cs.fontSize) < bodySize) out.push(`heading smaller than body: ${el.tagName}`);
		}
		// A key mark drawn twice: text in the mark span and the CSS ::before mark as well.
		for (const m of document.querySelectorAll(".key-mark")) if (m.textContent.trim() && getComputedStyle(m, "::before").content !== "none") out.push("key mark drawn twice");
		// Broken output: "null"/"undefined"/"NaN" as visible text, or a {placeholder} left in a string.
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = node.textContent.trim();
			if (!text || !node.parentElement?.getClientRects().length || node.parentElement.closest("script, style, textarea")) continue;
			if (/^(null|undefined|NaN)$/.test(text) || /\b(null|undefined|NaN)\b/.test(text.slice(0, 40)) || /\{[a-zA-Z]+\}/.test(text)) out.push(`broken text: "${text.slice(0, 40)}"`);
		}
		return [...new Set(out)];
	});
}
