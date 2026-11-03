// Page bodies for every route. Each function returns { key, id?, title, description, body,
// entry, index, crumbs?, jsonLd?, data?, twin? }; layout.js wraps it into a full document.
// Text comes from the locale files, examples are pre-rendered with the shared staff renderer.
import { KEY_SIGS, PIECES, PITCH_LESSONS, RHYTHM_LESSONS, altersFor } from "../content/catalog.js";
import legal, { UPDATED } from "../content/legal.js";
import { LICENSES } from "../content/licenses.js";
import { PHOTO_ASPECT, PHOTO_WIDTHS, PHOTOS } from "../content/photos.js";
import { octaveRange, renderStaticKeyboard } from "../core/keyboard-layout.js";
import { bars, parseMelody, systems, toStaffItems } from "../core/notation.js";
import { noteName } from "../core/notes.js";
import { renderStaff } from "../core/staff.js";
import { workedExample } from "../core/worked-example.js";
import { esc } from "./layout.js";
import { arrowLeft, arrowRight, bookOpen, ear, metronome, musicNote, musicNotes, notebook, pianoKeys, shuffle, textAa } from "../content/icons.js";
import { svgIcon } from "../core/icon.js";

const MODE_ICONS = { single: musicNote, row: musicNotes, ear, name: textAa, quiz: musicNote, tap: pianoKeys };

const para = (texts) => texts.map((p) => `<p>${esc(p)}</p>`).join("\n");

function author(cfg) {
	return { "@type": "Person", name: "Markus Silvo", url: "https://markussilvo.fi/", sameAs: ["https://github.com/Markus-web"] };
}

function breadcrumbLd(ctx, crumbs) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, ...(ctx.cfg.siteUrl ? { item: ctx.site.abs(c.href) } : {}) })),
	};
}

function exampleNames(notes, sys) {
	return notes.map((n) => noteName(n.step, n.alter, sys));
}

/**
 * Unsplash photo (src/content/photos.js) in the text column, with credit. Placed near the top
 * of a page, so it loads with high priority and is never lazy (it is the LCP candidate).
 */
function photo(ctx, id) {
	const { t, assets } = ctx;
	const p = PHOTOS[id];
	const files = assets.photos[id];
	const sizes = "(min-width: 44rem) 40rem, calc(100vw - 2rem)";
	const srcset = (list) => list.map(([url, w]) => `${url} ${w}w`).join(", ");
	const max = PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1];
	const fallback = files.webp.find(([, w]) => w === 800) ?? files.webp[0];
	return `<figure class="photo"><picture><source type="image/avif" srcset="${srcset(files.avif)}" sizes="${sizes}"><img src="${fallback[0]}" srcset="${srcset(files.webp)}" sizes="${sizes}" width="${max}" height="${max / PHOTO_ASPECT}" alt="${esc(t(`photos.${id}`))}" fetchpriority="high"></picture><figcaption>${esc(t("photos.by"))}: <a href="${esc(p.profile)}">${esc(p.photographer)}</a>, <a href="${esc(p.page)}">Unsplash</a></figcaption></figure>`;
}

/** Staff figure for a lesson guide: example notes with their names written under them. */
function lessonFigure(ctx, lesson) {
	const { t, dict } = ctx;
	const sys = dict.meta.noteNames;
	if (!lesson.staff) {
		const { low, high } = octaveRange("C3", "B5");
		const kb = renderStaticKeyboard({ low, high, highlight: lesson.highlight ?? [], noteNames: sys });
		return `<figure class="figure" tabindex="0">${kb}<figcaption>${esc(t("guide.keysExample"))}</figcaption></figure>`;
	}
	const notes = lesson.example ? lesson.example() : lesson.pool(lesson.keySigs?.[0]);
	const names = exampleNames(notes, sys);
	const keySig = lesson.exampleKeySig ? KEY_SIGS[lesson.exampleKeySig].alters : null;
	const caption = t("guide.exampleLabel", { names: names.join(", ") });
	const svg = renderStaff({
		staff: lesson.staff,
		keySig,
		items: notes.map((n, i) => ({ type: "note", value: "q", notes: [n], label: names[i] })),
		label: caption,
		scale: 1.15,
	});
	return `<figure class="figure" tabindex="0">${svg}<figcaption>${esc(caption)}</figcaption></figure>`;
}

export function homePage(ctx) {
	const { t, site, loc, dict } = ctx;
	const lessonCards = PITCH_LESSONS.map((l, i) => {
		const tx = dict.lessons[l.id];
		return `<li class="card" data-lesson="${l.id}"><h3><a href="${site.path("lesson", loc, l.id)}">${i + 1}. ${esc(tx.title)}</a></h3><p>${esc(tx.description)}</p><p class="status" data-status></p></li>`;
	}).join("\n");
	const rhythmCards = RHYTHM_LESSONS.map((r) => {
		const tx = dict.rhythm[r.id];
		return `<li class="card" data-rhythm="${r.id}"><h3><a href="${site.path("rhythm", loc, r.id)}">${esc(tx.title)}</a></h3><p>${esc(tx.description)}</p><p class="status" data-status></p></li>`;
	}).join("\n");
	const pieceCards = PIECES.slice(0, 3)
		.map((p) => {
			const m = dict.piecesMeta[p.id];
			return `<li class="card"><h3><a href="${site.path("piece", loc, p.id)}">${esc(m.title)}</a></h3><p>${esc(m.description)}</p></li>`;
		})
		.join("\n");
	const appLd = {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: t("site.name"),
		alternateName: loc === "fi" ? "Note Trainer" : "Nuottitreeni",
		description: t("site.description"),
		applicationCategory: "EducationalApplication",
		operatingSystem: "Any (web browser)",
		browserRequirements: "Requires JavaScript. MIDI keyboards need Web MIDI (Chrome, Edge, Opera, Firefox).",
		inLanguage: site.locales,
		isAccessibleForFree: true,
		offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
		author: author(ctx.cfg),
		license: "https://opensource.org/license/mit",
		codeRepository: ctx.cfg.sourceUrl,
		accessibilityFeature: ["highContrastDisplay", "displayTransformability", "longDescription", "structuralNavigation", "readingOrder"],
		accessibilityHazard: ["noFlashingHazard", "noMotionSimulationHazard"],
		accessMode: ["visual", "auditory", "textual"],
		...(ctx.cfg.siteUrl ? { url: site.abs(site.path("home", loc)) } : {}),
	};
	return {
		key: "home",
		title: t("home.title"),
		description: t("site.description"),
		entry: "home",
		index: true,
		jsonLd: [appLd],
		body: `<h1>${esc(t("home.title"))}</h1>
<p class="lead">${esc(t("home.intro"))}</p>
<section aria-labelledby="start-h" data-section="lessons"><h2 id="start-h">${esc(t("home.startHeading"))}</h2>
<ol class="steps">
<li><h3>${esc(t("home.step1Title"))}</h3><p>${esc(t("home.step1"))}</p></li>
<li><h3>${esc(t("home.step2Title"))}</h3><p>${esc(t("home.step2"))}</p><p><a class="btn btn-primary" href="${site.path("lesson", loc, PITCH_LESSONS[0].id)}">${svgIcon(arrowRight)}${esc(t("home.step2Link"))}</a></p></li>
<li><h3>${esc(t("home.step3Title"))}</h3><p>${esc(t("home.step3"))}</p></li>
</ol></section>
${photo(ctx, "keys")}
<section aria-labelledby="practice-h"><h2 id="practice-h">${svgIcon(notebook, "section-icon")}${esc(t("home.practiceHeading"))}</h2>
<p id="practice-summary">${esc(t("home.practiceEmpty"))}</p></section>
<section aria-labelledby="pitch-h" data-section="lessons"><h2 id="pitch-h">${svgIcon(bookOpen, "section-icon")}${esc(t("home.pitchHeading"))}</h2>
<p>${esc(t("home.pitchIntro"))}</p>
<ol class="cards" id="lesson-cards">${lessonCards}</ol>
</section>
<section aria-labelledby="free-h" data-section="free"><h2 id="free-h">${svgIcon(shuffle, "section-icon")}${esc(t("free.title"))}</h2>
<p>${esc(t("free.intro"))}</p>
<p><a class="standalone" href="${site.path("freePractice", loc)}">${esc(t("free.homeLink"))}${svgIcon(arrowRight)}</a></p></section>
<section aria-labelledby="rhythm-h" data-section="rhythm"><h2 id="rhythm-h">${svgIcon(metronome, "section-icon")}${esc(t("home.rhythmHeading"))}</h2>
<p>${esc(t("home.rhythmIntro"))}</p>
<ul class="cards" id="rhythm-cards">${rhythmCards}</ul></section>
<section aria-labelledby="pieces-h" data-section="pieces"><h2 id="pieces-h">${svgIcon(musicNotes, "section-icon")}${esc(t("home.piecesHeading"))}</h2>
<p>${esc(t("home.piecesIntro"))}</p>
<ul class="cards">${pieceCards}</ul>
<p><a class="standalone" href="${site.path("pieces", loc)}">${esc(t("home.piecesLink"))}${svgIcon(arrowRight)}</a></p></section>`,
	};
}

export function lessonPage(ctx, lesson, index) {
	const { t, site, loc, dict } = ctx;
	const tx = dict.lessons[lesson.id];
	const prev = PITCH_LESSONS[index - 1];
	const next = PITCH_LESSONS[index + 1];
	const practice = site.path("practice", loc);
	const modes = lesson.modes
		.map((m) => `<li><a class="btn${m === "single" ? " btn-primary" : ""}" href="${practice}?l=${lesson.id}&amp;m=${m}">${svgIcon(MODE_ICONS[m])}${esc(t(`modes.${m}.label`))}</a><p class="hint">${esc(t(`modes.${m}.description`))}</p></li>`)
		.join("");
	const crumbs = [
		{ name: t("common.home"), href: site.path("home", loc) },
		{ name: tx.title, href: site.path("lesson", loc, lesson.id) },
	];
	const pager = `<nav class="pager" aria-label="${esc(t("guide.lessons"))}">${
		prev ? `<a href="${site.path("lesson", loc, prev.id)}" rel="prev">${svgIcon(arrowLeft)}${esc(t("guide.previousLesson"))}: ${esc(dict.lessons[prev.id].title)}</a>` : "<span></span>"
	}${next ? `<a href="${site.path("lesson", loc, next.id)}" rel="next">${esc(t("guide.nextLesson"))}: ${esc(dict.lessons[next.id].title)}${svgIcon(arrowRight)}</a>` : ""}</nav>`;
	return {
		key: "lesson",
		id: lesson.id,
		title: tx.title,
		description: tx.description,
		entry: "guide",
		index: true,
		crumbs,
		twin: (l) => site.path("lesson", l, lesson.id),
		data: { lesson: lesson.id, previous: prev?.id ?? null },
		jsonLd: [
			{
				"@context": "https://schema.org",
				"@type": "LearningResource",
				name: tx.title,
				description: tx.description,
				learningResourceType: "Lesson",
				educationalLevel: "Beginner",
				inLanguage: loc,
				isAccessibleForFree: true,
				teaches: tx.title,
				position: index + 1,
				author: author(ctx.cfg),
				...(ctx.cfg.siteUrl ? { url: site.abs(site.path("lesson", loc, lesson.id)) } : {}),
			},
			breadcrumbLd(ctx, crumbs),
		],
		body: `<h1>${esc(tx.title)}</h1>
<p class="lead">${esc(tx.description)}</p>
<div class="learn">${para(tx.learn)}</div>
${lessonFigure(ctx, lesson)}
${lesson.worked ? `<section aria-labelledby="example-h"><h2 id="example-h">${esc(t("guide.example"))}</h2>${workedExample(lesson.worked, { t, noteNames: dict.meta.noteNames, keySig: lesson.exampleKeySig ? KEY_SIGS[lesson.exampleKeySig].alters : null })}</section>` : ""}
<p class="notice" id="not-yet" hidden></p>
<h2>${esc(t("guide.chooseMode"))}</h2>
<ul class="modes">${modes}</ul>
<p><strong>${esc(t("guide.remember"))}</strong> ${esc(tx.hint)}</p>
${pager}`,
	};
}

export function rhythmPage(ctx, lesson, index) {
	const { t, site, loc, dict } = ctx;
	const tx = dict.rhythm[lesson.id];
	const crumbs = [
		{ name: t("common.home"), href: site.path("home", loc) },
		{ name: tx.title, href: site.path("rhythm", loc, lesson.id) },
	];
	let example = "";
	if (lesson.kind === "quiz") {
		const items = lesson.items.map((it) =>
			it.rest ? { type: "rest", value: it.value, clef: "treble" } : { type: "note", value: it.value, notes: [{ step: "B", alter: 0, octave: 4, clef: "treble", written: null }] },
		);
		const svg = renderStaff({ staff: "treble", items, label: tx.title, scale: 1.15 });
		example = `<figure class="figure" tabindex="0">${svg}<figcaption>${esc(lesson.items.map((it) => `${t(`piece.values.${it.rest ? "rest" : it.value}`)}${it.rest ? ` (${it.value})` : ""}: ${it.beats}`).join(", "))}</figcaption></figure>`;
	} else {
		const melody = lesson.kind === "meter" ? "B4h B4q B4q | B4q B4q B4q" : lesson.patterns[0];
		const svg = renderStaff({ staff: "treble", timeSig: lesson.kind === "meter" ? [4, 4] : [4, 4], items: toStaffItems(parseMelody(melody), "treble"), label: tx.title, scale: 1.15 });
		example = `<figure class="figure" tabindex="0">${svg}</figure>`;
	}
	const next = RHYTHM_LESSONS[index + 1];
	return {
		key: "rhythm",
		id: lesson.id,
		title: tx.title,
		description: tx.description,
		entry: "guide",
		index: true,
		crumbs,
		twin: (l) => site.path("rhythm", l, lesson.id),
		data: { rhythm: lesson.id },
		jsonLd: [
			{
				"@context": "https://schema.org",
				"@type": "LearningResource",
				name: tx.title,
				description: tx.description,
				learningResourceType: "Lesson",
				educationalLevel: "Beginner",
				inLanguage: loc,
				isAccessibleForFree: true,
				author: author(ctx.cfg),
			},
			breadcrumbLd(ctx, crumbs),
		],
		body: `<h1>${esc(tx.title)}</h1>
<p class="lead">${esc(tx.description)}</p>
<div class="learn">${para(tx.learn)}</div>
${example}
<ul class="modes">${lesson.modes
			.map(
				(m) =>
					`<li><a class="btn btn-primary" href="${site.path("rhythmPractice", loc)}?l=${lesson.id}">${svgIcon(MODE_ICONS[m])}${esc(t(`modes.${m}.label`))}</a><p class="hint">${esc(t(`modes.${m}.description`))}</p></li>`,
			)
			.join("")}</ul>
${next ? `<nav class="pager" aria-label="${esc(t("guide.lessons"))}"><span></span><a href="${site.path("rhythm", loc, next.id)}" rel="next">${esc(t("guide.nextLesson"))}: ${esc(dict.rhythm[next.id].title)}${svgIcon(arrowRight)}</a></nav>` : ""}`,
	};
}

/** Shell pages filled by JavaScript; still have a real heading, intro and no-JS notice. */
function shell(ctx, key, entry, title, intro = "", extra = "") {
	const { t } = ctx;
	return {
		key,
		title,
		description: intro || title,
		entry,
		index: false,
		body: `<h1 id="page-title" tabindex="-1">${esc(title)}</h1>
${intro ? `<p class="lead">${esc(intro)}</p>` : ""}
<noscript><p class="notice">${esc(t("common.noscript"))}</p></noscript>
<div id="app-root"></div>
${extra}`,
	};
}

export function practicePage(ctx) {
	return shell(ctx, "practice", "practice", ctx.t("drill.titleSuffix"));
}
export function freePracticePage(ctx) {
	return shell(ctx, "freePractice", "practice", ctx.t("free.title"), ctx.t("free.intro"));
}
export function rhythmPracticePage(ctx) {
	return shell(ctx, "rhythmPractice", "rhythm", ctx.t("home.rhythmHeading"));
}
export function myPiecePage(ctx) {
	return shell(ctx, "myPiece", "piece", ctx.t("pieces.importHeading"));
}
export function logPage(ctx) {
	return shell(ctx, "log", "log", ctx.t("log.title"), ctx.t("log.intro"));
}
export function devicesPage(ctx) {
	return shell(ctx, "devices", "devices", ctx.t("devicesPage.title"), ctx.t("devicesPage.intro"));
}
export function settingsPage(ctx) {
	return shell(ctx, "settings", "settings", ctx.t("settings.title"));
}

export function piecesPage(ctx) {
	const { t, site, loc, dict } = ctx;
	const cards = PIECES.map((p) => {
		const m = dict.piecesMeta[p.id];
		const lessonTitle = dict.lessons[p.lesson]?.title ?? "";
		return `<li class="card"><h2 class="card-title"><a href="${site.path("piece", loc, p.id)}">${esc(m.title)}</a></h2><p>${esc(m.description)}</p><p class="meta-line">${esc(t("pieces.level", { n: p.level }))}. ${esc(
			t("pieces.after", { title: lessonTitle }),
		)}</p></li>`;
	}).join("\n");
	return {
		key: "pieces",
		title: t("pieces.title"),
		description: t("pieces.metaDescription"),
		entry: "pieces",
		index: true,
		body: `<h1>${esc(t("pieces.title"))}</h1>
<p class="lead">${esc(t("pieces.intro"))}</p>
${photo(ctx, "music-stand")}
<ul class="cards">${cards}</ul>
<section aria-labelledby="import-h"><h2 id="import-h">${esc(t("pieces.importHeading"))}</h2>
<p>${esc(t("pieces.importIntro"))}</p>
<div class="field"><label for="import-file">${esc(t("pieces.importLabel"))}</label>
<input type="file" id="import-file" accept=".musicxml,.xml,.mxl,.mid,.midi,application/vnd.recordare.musicxml+xml,audio/midi" disabled></div>
<div id="import-status" role="status"></div>
<h3>${esc(t("pieces.myPieces"))}</h3>
<ul id="my-pieces"></ul>
<p class="hint">${esc(t("pieces.scansHint"))}</p>
<p class="hint">${esc(t("pieces.copyrightHint"))}</p></section>`,
	};
}

/** Text alternative for a built-in piece, generated from its notation. */
function pieceText(ctx, piece) {
	const { t, dict } = ctx;
	const sys = dict.meta.noteNames;
	return bars(parseMelody(piece.right))
		.map((bar, i) => {
			const items = bar
				.map((it) =>
					it.type === "rest"
						? t("piece.values.rest")
						: `${it.notes.map((n) => `${noteName(n.step, n.alter, sys)}${n.octave}`).join("+")} ${t(`piece.values.${it.value}`)}`,
				)
				.join(", ");
			return `<li>${esc(t("piece.bar", { n: i + 1 }))}: ${esc(items)}</li>`;
		})
		.join("");
}

/** Built-in piece engraved with the own renderer, one system per 4 bars (static, no engine). */
export function renderSystems(ctx, piece, stateFor = () => "") {
	const { t, dict } = ctx;
	const alters = altersFor(piece.fifths);
	return systems(piece.right, { alters })
		.map((sys, li) => {
			let step = sys.firstStep;
			const items = sys.items.map((it) => (it.type === "note" ? { ...it, state: stateFor(step), step: step++ } : it));
			return renderStaff({
				staff: "treble",
				keySig: Object.keys(alters).length ? alters : null,
				timeSig: li === 0 ? piece.time : null,
				items,
				label: `${dict.piecesMeta[piece.id].title}, ${t("piece.bar", { n: sys.firstBar })}`,
				scale: 1,
				className: "staff-system",
			});
		})
		.join("");
}

export function piecePage(ctx, piece) {
	const { t, site, loc, dict } = ctx;
	const m = dict.piecesMeta[piece.id];
	const key = (piece.minor ? dict.piece.keyMinor : dict.piece.keyMajor)[piece.fifths] ?? "";
	const barCount = bars(parseMelody(piece.right)).length;
	const figure = t("piece.figure", { title: m.title, composer: piece.composer, key, time: `${piece.time[0]}/${piece.time[1]}`, bars: barCount });
	const crumbs = [
		{ name: t("common.home"), href: site.path("home", loc) },
		{ name: t("pieces.title"), href: site.path("pieces", loc) },
		{ name: m.title, href: site.path("piece", loc, piece.id) },
	];
	return {
		key: "piece",
		id: piece.id,
		title: m.title,
		description: m.description,
		entry: "piece",
		index: true,
		crumbs,
		twin: (l) => site.path("piece", l, piece.id),
		data: { piece: piece.id },
		jsonLd: [
			{
				"@context": "https://schema.org",
				"@type": "LearningResource",
				name: m.title,
				description: m.description,
				learningResourceType: "Sheet music",
				educationalLevel: "Beginner",
				inLanguage: loc,
				isAccessibleForFree: true,
				author: author(ctx.cfg),
				about: { "@type": "MusicComposition", name: m.title, composer: { "@type": "Person", name: piece.composer } },
			},
			breadcrumbLd(ctx, crumbs),
		],
		body: `<h1 id="page-title" tabindex="-1">${esc(m.title)}</h1>
<p class="lead">${esc(m.description)}</p>
<p class="meta-line">${esc(t("pieces.composer", { name: piece.composer }))}. ${esc(t("pieces.level", { n: piece.level }))}. <a href="${site.path("lesson", loc, piece.lesson)}">${esc(t("pieces.after", { title: dict.lessons[piece.lesson].title }))}</a></p>
<figure class="figure" tabindex="0"><div id="score" class="score-systems">${renderSystems(ctx, piece)}</div><figcaption>${esc(figure)}</figcaption></figure>
<details><summary>${esc(t("piece.asText"))}</summary><ol class="results">${pieceText(ctx, piece)}</ol></details>
<noscript><p class="notice">${esc(t("common.noscript"))}</p></noscript>
<div id="app-root"></div>`,
	};
}

export function glossaryPage(ctx) {
	const { t, dict, loc } = ctx;
	const items = dict.glossary.map(([term, def]) => `<dt id="${esc(term.toLowerCase().replace(/[^a-z0-9äöå]+/g, "-"))}">${esc(term)}</dt><dd>${esc(def)}</dd>`).join("");
	return {
		key: "glossary",
		title: t("glossaryPage.title"),
		description: t("glossaryPage.intro"),
		entry: "static",
		index: true,
		jsonLd: [
			{
				"@context": "https://schema.org",
				"@type": "DefinedTermSet",
				name: t("glossaryPage.title"),
				inLanguage: loc,
				hasDefinedTerm: dict.glossary.map(([term, def]) => ({ "@type": "DefinedTerm", name: term, description: def })),
			},
		],
		body: `<h1>${esc(t("glossaryPage.title"))}</h1>
<p class="lead">${esc(t("glossaryPage.intro"))}</p>
<dl class="glossary">${items}</dl>`,
	};
}

export function helpPage(ctx) {
	const { t, dict } = ctx;
	return {
		key: "help",
		title: t("helpPage.title"),
		description: t("helpPage.intro"),
		entry: "static",
		index: true,
		jsonLd: [
			{
				"@context": "https://schema.org",
				"@type": "FAQPage",
				mainEntity: dict.help.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
			},
		],
		body: `<h1>${esc(t("helpPage.title"))}</h1>
<p class="lead">${esc(t("helpPage.intro"))}</p>
${photo(ctx, "hands")}
<div class="faq">${dict.help.map(([q, a]) => `<section><h2>${esc(q)}</h2><p>${esc(a)}</p></section>`).join("\n")}</div>`,
	};
}

export function aboutPage(ctx) {
	const { t, cfg } = ctx;
	const operator = cfg.operatorName ? esc(t("common.operator", { name: cfg.operatorName })) : `<span data-operator-line>${esc(t("common.operatorUnknown"))}</span>`;
	return {
		key: "about",
		title: t("about.title"),
		description: t("about.description"),
		entry: "static",
		index: true,
		jsonLd: [{ "@context": "https://schema.org", "@type": "AboutPage", name: t("about.title"), author: author(cfg) }],
		body: `<h1>${esc(t("about.title"))}</h1>
${photo(ctx, "sheet-music")}
${para(t("about.body"))}
<dl class="glossary">
<dt>${esc(t("about.author"))}</dt><dd><a class="standalone" href="https://markussilvo.fi/">${esc(t("about.authorLink"))}</a></dd>
<dt>${esc(t("about.instance"))}</dt><dd>${operator}</dd>
<dt>${esc(t("footer.source"))}</dt><dd><a class="standalone" href="${esc(cfg.sourceUrl)}">${esc(t("about.source"))}</a></dd>
<dt>${esc(t("about.version", { version: "" }).trim())}</dt><dd>${esc(cfg.version)}</dd>
</dl>`,
	};
}

function fillLegal(text, ctx) {
	const { cfg, site, loc } = ctx;
	const op = cfg.operatorName ? esc(cfg.operatorName) : `<span data-operator-name>${esc(ctx.t("common.operatorUnknown"))}</span>`;
	const contact = cfg.operatorContact
		? cfg.operatorContact.includes("@")
			? `<a href="mailto:${esc(cfg.operatorContact)}">${esc(cfg.operatorContact)}</a>`
			: `<a href="${esc(cfg.operatorContact)}">${esc(cfg.operatorContact)}</a>`
		: '<span data-operator-contact>-</span>';
	const place = cfg.operatorPlace ? `, ${esc(cfg.operatorPlace)}` : "";
	const siteText = cfg.siteUrl ? esc(cfg.siteUrl.replace(/^https?:\/\//, "")) : esc(ctx.t("site.name"));
	const [y, mo, d] = UPDATED.split("-").map(Number);
	const updated = loc === "fi" ? `${d}.${mo}.${y}` : new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
	return esc(text)
		.replace("{operator}", op)
		.replace("{contact}", contact)
		.replace("{place}", place)
		.replace("{site}", siteText)
		.replace("{updated}", updated);
}

function legalPage(ctx, key, doc) {
	const body = [`<h1>${esc(doc.title)}</h1>`, `<p class="lead">${esc(doc.lede)}</p>`, `<p><strong>${fillLegal(doc.updated, ctx)}</strong></p>`];
	for (const s of doc.sections) {
		body.push(`<h2>${esc(s.h)}</h2>`);
		for (const p of s.p ?? []) body.push(`<p>${fillLegal(p, ctx)}</p>`);
		if (s.list) body.push(`<ul>${s.list.map((li) => `<li>${fillLegal(li, ctx)}</li>`).join("")}</ul>`);
		for (const p of s.after ?? []) body.push(`<p>${fillLegal(p, ctx)}</p>`);
	}
	return { key, title: doc.title, description: doc.lede, entry: "static", index: true, body: body.join("\n") };
}

export function privacyPage(ctx) {
	return legalPage(ctx, "privacy", (legal[ctx.loc] ?? legal.en).privacy);
}
export function accessibilityPage(ctx) {
	return legalPage(ctx, "accessibility", (legal[ctx.loc] ?? legal.en).accessibility);
}

export function licensesPage(ctx) {
	const { t, loc } = ctx;
	const rows = LICENSES.map((l) => `<tr><td><a class="standalone" href="${esc(l.url)}">${esc(l.name)}</a> ${esc(l.version)}</td><td>${esc(l.license)}</td><td>${esc(l.use[loc] ?? l.use.en)}</td></tr>`).join("");
	return {
		key: "licenses",
		title: t("licensesPage.title"),
		description: t("licensesPage.intro"),
		entry: "static",
		index: true,
		body: `<h1>${esc(t("licensesPage.title"))}</h1>
<p class="lead">${esc(t("licensesPage.intro"))}</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(t("licensesPage.title"))}"><table><thead><tr><th scope="col">${esc(t("licensesPage.component"))}</th><th scope="col">${esc(t("licensesPage.license"))}</th><th scope="col">${esc(t("licensesPage.use"))}</th></tr></thead><tbody>${rows}</tbody></table></div>`,
	};
}

export function streamPage(ctx) {
	const { t } = ctx;
	return {
		key: "stream",
		title: t("stream.title"),
		description: t("stream.intro"),
		entry: "stream",
		index: false,
		bare: true,
		bodyClass: "stream",
		body: `<h1 class="visually-hidden">${esc(t("stream.title"))}</h1>
<noscript><p class="notice">${esc(t("common.noscript"))}</p></noscript>
<div id="app-root"></div>`,
	};
}

export function notFoundBody(dicts, site) {
	return site.locales
		.map((l) => {
			const d = dicts[l].notFound;
			return `<section lang="${l}"><h${l === site.defaultLocale ? 1 : 2}>${esc(d.title)}</h${l === site.defaultLocale ? 1 : 2}><p>${esc(d.body)}</p><p><a class="standalone" href="${site.path("home", l)}">${esc(d.home)}</a></p></section>`;
		})
		.join("\n");
}
