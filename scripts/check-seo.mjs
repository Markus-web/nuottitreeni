#!/usr/bin/env node
// SEO and GEO checks on a built dist/ (no browser): titles, descriptions, robots, canonical,
// hreflang (complete and reciprocal), JSON-LD, internal links, sitemap = indexable pages,
// robots.txt and llms.txt links. Used by the browser suite and runnable on its own:
//   NT_SITE_URL=https://piano.example node scripts/check-seo.mjs [dist]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

function walk(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : []));
}

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export function checkSeo(dist, { siteUrl }) {
	const problems = [];
	const pages = new Map();
	for (const file of walk(dist)) {
		const rel = `/${relative(dist, file).replaceAll("\\", "/")}`;
		const path = rel.endsWith("/index.html") ? rel.slice(0, -"index.html".length) : rel;
		const html = readFileSync(file, "utf8");
		const head = html.slice(0, html.indexOf("</head>"));
		const meta = (name) => decode(head.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1] ?? "");
		pages.set(path, {
			html,
			title: decode(head.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""),
			description: meta("description"),
			robots: meta("robots"),
			canonical: head.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null,
			alternates: [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ lang: m[1], href: m[2] })),
			jsonld: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
			links: [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => decode(m[1])),
			imgs: [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]),
			h1: (html.match(/<h1[\s>]/g) || []).length,
		});
	}
	const indexable = [...pages].filter(([, p]) => p.robots.startsWith("index"));
	const seenTitles = new Map();
	const seenDesc = new Map();
	for (const [path, p] of pages) {
		if (path === "/404.html") continue;
		if (!p.title) problems.push(`${path}: no title`);
		if (p.h1 < 1) problems.push(`${path}: no h1`);
		for (const img of p.imgs) if (!/ alt="/.test(img)) problems.push(`${path}: img without alt`);
		for (const ld of p.jsonld) {
			try {
				const data = JSON.parse(ld);
				if (!data["@context"] || !data["@type"]) problems.push(`${path}: JSON-LD without @context/@type`);
			} catch {
				problems.push(`${path}: JSON-LD does not parse`);
			}
		}
		for (const href of p.links) {
			if (!href.startsWith("/") || href.startsWith("//")) continue;
			const clean = href.split(/[?#]/)[0];
			const target = clean.endsWith("/") ? join(dist, clean, "index.html") : join(dist, clean);
			if (!existsSync(target) && !(existsSync(join(dist, clean)) && statSync(join(dist, clean)).isDirectory())) problems.push(`${path}: broken link ${href}`);
		}
	}
	for (const [path, p] of indexable) {
		if (p.title.length > 70) problems.push(`${path}: title ${p.title.length} chars`);
		if (p.description.length < 50 || p.description.length > 160) problems.push(`${path}: description ${p.description.length} chars`);
		if (seenTitles.has(p.title)) problems.push(`${path}: duplicate title with ${seenTitles.get(p.title)}`);
		seenTitles.set(p.title, path);
		if (seenDesc.has(p.description) && !path.includes("/oppitunnit/") && !path.includes("/lessons/")) {
			/* identical descriptions are allowed only for legal pages sharing a lede; report others */
			if (!/tietosuoja|privacy|saavutettavuus|accessibility/.test(path)) problems.push(`${path}: duplicate description with ${seenDesc.get(p.description)}`);
		}
		seenDesc.set(p.description, path);
		if (siteUrl) {
			if (p.canonical !== siteUrl + path) problems.push(`${path}: canonical ${p.canonical}`);
			const langs = p.alternates.map((a) => a.lang);
			if (!langs.includes("x-default")) problems.push(`${path}: no x-default hreflang`);
			for (const alt of p.alternates) {
				if (!alt.href.startsWith(siteUrl)) {
					problems.push(`${path}: hreflang ${alt.lang} not absolute`);
					continue;
				}
				const other = pages.get(alt.href.slice(siteUrl.length));
				if (!other) problems.push(`${path}: hreflang ${alt.lang} target missing ${alt.href}`);
				else if (!other.alternates.some((x) => x.href === siteUrl + path)) problems.push(`${path}: hreflang ${alt.lang} not reciprocal`);
			}
		}
	}
	if (siteUrl) {
		const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
		const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
		const expected = new Set(indexable.map(([path]) => siteUrl + path));
		for (const u of expected) if (!locs.has(u)) problems.push(`sitemap missing ${u}`);
		for (const u of locs) if (!expected.has(u)) problems.push(`sitemap has non-indexable ${u}`);
		const robots = readFileSync(join(dist, "robots.txt"), "utf8");
		if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) problems.push("robots.txt without sitemap");
		const llms = readFileSync(join(dist, "llms.txt"), "utf8");
		for (const m of llms.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) {
			const url = m[1];
			if (!url.startsWith(siteUrl)) continue;
			if (!pages.has(url.slice(siteUrl.length))) problems.push(`llms.txt link missing ${url}`);
		}
	}
	return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const dist = process.argv[2] || join(fileURLToPath(new URL("..", import.meta.url)), "dist");
	const problems = checkSeo(dist, { siteUrl: (process.env.NT_SITE_URL || "").replace(/\/+$/, "") });
	for (const p of problems) console.log(p);
	console.log(problems.length ? `${problems.length} SEO problems` : "SEO checks passed");
	process.exit(problems.length ? 1 : 0);
}
