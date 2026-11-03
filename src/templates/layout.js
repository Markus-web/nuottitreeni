// Page shell used by the build for every HTML page: head (SEO, social, preloads, config),
// header with navigation and device status, footer. Output is a complete HTML string.
import { code, gear, githubLogo, house, microphone, musicNotes, notebook, pianoKeys, plugs, translate } from "../content/icons.js";
import { svgIcon } from "../core/icon.js";
import { escapeXml as esc } from "../core/staff.js";

export { esc };

/**
 * Main navigation: the four things people do (page key, label key, icon). Lesson, rhythm and
 * practice pages mark "home" (the lesson path) current. Devices sits in the device row, and the
 * reference pages are in the footer, so the header stays short on a phone.
 */
const NAV = [
	["home", "nav.home", house],
	["pieces", "nav.pieces", musicNotes],
	["log", "nav.log", notebook],
	["settings", "nav.settings", gear],
];
/** Footer groups: heading key, then [page key, label key]. */
const FOOTER = [
	["footer.practiceHeading", [["devices", "nav.devices"], ["freePractice", "free.title"], ["phrases", "phrases.title"], ["speed", "speed.title"], ["explore", "explore.title"], ["help", "nav.help"], ["glossary", "nav.glossary"]]],
	["footer.siteHeading", [["about", "footer.about"], ["privacy", "footer.privacy"], ["accessibility", "footer.accessibility"], ["licenses", "footer.licenses"]]],
];
const NAV_SECTION = { lesson: "home", rhythm: "home", practice: "home", freePractice: "home", phrases: "home", speed: "home", explore: "home", rhythmPractice: "home", piece: "pieces", myPiece: "pieces" };
/** Section colour per page (body data-section, see main.css); pages not listed use the accent. */
const COLOR_SECTION = { home: "lessons", lesson: "lessons", practice: "lessons", rhythm: "rhythm", rhythmPractice: "rhythm", pieces: "pieces", piece: "pieces", myPiece: "pieces", freePractice: "free", phrases: "free", speed: "free", explore: "free" };

function jsonScript(type, data, id) {
	// "<" escaped so the JSON can never close the script element.
	return `<script type="${type}"${id ? ` id="${id}"` : ""}>${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

export function layout(ctx, page) {
	const { loc, t, site, cfg, assets, dicts } = ctx;
	const siteName = t("site.name");
	const fullTitle = page.key === "home" ? `${siteName}, ${t("home.title").toLowerCase()}` : `${page.title}, ${siteName}`;
	const path = page.path;
	const indexable = cfg.indexable && page.index;
	const twins = site.locales.map((l) => ({ loc: l, path: page.twin ? page.twin(l) : path }));
	const head = [];
	head.push('<meta charset="utf-8">');
	head.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
	head.push(`<title>${esc(fullTitle)}</title>`);
	head.push(`<meta name="description" content="${esc(page.description)}">`);
	head.push(`<meta name="robots" content="${indexable ? "index, follow" : "noindex, follow"}">`);
	head.push(`<meta name="generator" content="Nuottitreeni ${esc(cfg.version)}">`);
	if (cfg.siteUrl) {
		head.push(`<link rel="canonical" href="${esc(site.abs(path))}">`);
		if (page.index) {
			for (const tw of twins) head.push(`<link rel="alternate" hreflang="${tw.loc}" href="${esc(site.abs(tw.path))}">`);
			head.push(`<link rel="alternate" hreflang="x-default" href="${esc(site.abs(page.twin ? page.twin(site.defaultLocale) : path))}">`);
		}
	}
	head.push(`<meta property="og:type" content="website">`);
	head.push(`<meta property="og:site_name" content="${esc(siteName)}">`);
	head.push(`<meta property="og:title" content="${esc(page.title)}">`);
	head.push(`<meta property="og:description" content="${esc(page.description)}">`);
	head.push(`<meta property="og:locale" content="${dicts[loc].meta.ogLocale}">`);
	for (const l of site.locales) if (l !== loc) head.push(`<meta property="og:locale:alternate" content="${dicts[l].meta.ogLocale}">`);
	if (cfg.siteUrl) {
		head.push(`<meta property="og:url" content="${esc(site.abs(path))}">`);
		head.push(`<meta property="og:image" content="${esc(site.abs(assets.og[loc] ?? assets.og[site.defaultLocale]))}">`);
		head.push('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">');
	}
	head.push('<meta name="twitter:card" content="summary_large_image">');
	head.push('<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">');
	head.push('<meta name="theme-color" content="#f4f4f4" media="(prefers-color-scheme: light)">');
	head.push(`<link rel="icon" href="${assets.icons.svg}" type="image/svg+xml">`);
	head.push(`<link rel="icon" href="${assets.icons.png32}" type="image/png" sizes="32x32">`);
	head.push(`<link rel="apple-touch-icon" href="${assets.icons.png180}">`);
	head.push('<link rel="manifest" href="/manifest.webmanifest">');
	for (const f of assets.preloadFonts) head.push(`<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`);
	head.push(`<link rel="stylesheet" href="${assets.css}">`);
	const entry = assets.entries[page.entry];
	// The theme script starts the page's module one frame after the first paint (theme-init.js).
	head.push(`<script src="${assets.themeJs}" data-entry="${entry.file}" data-preload="${[...entry.preload, assets.localeChunks[loc]].join(" ")}"></script>`);
	head.push(
		jsonScript(
			"application/json",
			{
				page: page.key,
				id: page.id ?? null,
				locale: loc,
				locales: site.locales,
				defaultLocale: site.defaultLocale,
				version: cfg.version,
				sourceUrl: cfg.sourceUrl,
				operator: cfg.operatorName ? { name: cfg.operatorName, contact: cfg.operatorContact, place: cfg.operatorPlace } : null,
				localeChunk: assets.localeChunks[loc],
				samples: assets.samples,
				osmd: assets.osmd,
				pieces: assets.pieces,
				paths: ctx.paths[loc],
				data: page.data ?? null,
			},
			"nt-config",
		),
	);
	for (const ld of page.jsonLd ?? []) head.push(jsonScript("application/ld+json", ld));

	const section = NAV_SECTION[page.key] ?? page.key;
	const navItems = NAV.map(([key, label, icon]) => {
		const href = site.path(key, loc);
		const current = section === key ? ' aria-current="page"' : "";
		return `<li><a href="${href}"${current}>${svgIcon(icon)}${esc(t(label))}</a></li>`;
	}).join("");
	const langLinks = twins
		.filter((tw) => tw.loc !== loc)
		.map((tw) => `<a class="lang-link" href="${tw.path}" lang="${tw.loc}" hreflang="${tw.loc}" data-lang-link="${tw.loc}">${svgIcon(translate)}${esc(dicts[tw.loc].meta.switchLabel)}</a>`)
		.join("");

	const crumbs = page.crumbs
		? `<nav class="breadcrumbs" aria-label="${esc(t("common.breadcrumb"))}"><ol>${page.crumbs
				.map((c, i) => (i === page.crumbs.length - 1 ? `<li><span aria-current="page">${esc(c.name)}</span></li>` : `<li><a href="${c.href}">${esc(c.name)}</a></li>`))
				.join("")}</ol></nav>`
		: "";

	const operatorLine = cfg.operatorName
		? esc(t("common.operator", { name: cfg.operatorName }))
		: `<span data-operator-line>${esc(t("common.operatorUnknown"))}</span>`;

	const footerLink = ([key, label]) => `<li><a href="${site.path(key, loc)}"${page.key === key ? ' aria-current="page"' : ""}>${esc(t(label))}</a></li>`;
	const source = `<li><a href="${esc(cfg.sourceUrl)}">${svgIcon(/^https:\/\/github\.com\//.test(cfg.sourceUrl) ? githubLogo : code)}${esc(t("footer.source"))}</a></li>`;
	const footer = `<footer class="site-footer"><div class="wrap">
<nav class="footer-nav" aria-label="${esc(t("common.footerNav"))}">${FOOTER.map(
		([heading, links], i) => `<div><h2 class="footer-heading">${esc(t(heading))}</h2><ul>${links.map(footerLink).join("")}${i === FOOTER.length - 1 ? source : ""}</ul></div>`,
	).join("")}</nav>
<p>${operatorLine} ${esc(t("common.openSource"))}. ${esc(t("about.version", { version: cfg.version }))}</p>
<div class="footer-tools" hidden data-theme-tools><label for="theme-select">${esc(t("theme.label"))}</label>
<select id="theme-select"><option value="system">${esc(t("theme.system"))}</option><option value="dark">${esc(t("theme.dark"))}</option><option value="light">${esc(t("theme.light"))}</option></select></div>
<p class="footer-note" data-offline-note>${esc(t("common.offlineReady"))}</p>
</div></footer>`;

	const header = `<header class="site-header"><div class="wrap header-row">
<a class="brand" href="${site.path("home", loc)}">${svgIcon(pianoKeys, "icon-brand")}${esc(siteName)}</a>
<nav class="main-nav" aria-label="${esc(t("common.mainNav"))}"><ul>${navItems}</ul></nav>
${langLinks}
</div>
<div class="wrap device-row">
<p class="device-status" id="device-status" role="status" data-state="off">${esc(t("device.statusNone"))}</p>
<button type="button" class="btn btn-primary" id="device-connect" data-mode="midi">${svgIcon(plugs, "icon-midi")}${svgIcon(microphone, "icon-mic")}<span>${esc(t("device.connectInstrument"))}</span></button>
<a class="device-more" href="${site.path("devices", loc)}"${section === "devices" ? ' aria-current="page"' : ""}>${esc(t("nav.devices"))}</a>
</div></header>`;

	return `<!doctype html>
<html lang="${loc}">
<head>
${head.join("\n")}
</head>
<body${page.bodyClass ? ` class="${page.bodyClass}"` : ""}${COLOR_SECTION[page.key] ? ` data-section="${COLOR_SECTION[page.key]}"` : ""}>
<a class="skip-link" href="#main">${esc(t("common.skip"))}</a>
${page.bare ? "" : header}
<div class="wrap" id="banners"></div>
<main id="main" tabindex="-1" class="wrap">
${crumbs}
${page.body}
</main>
${page.bare ? "" : footer}
</body>
</html>
`;
}
