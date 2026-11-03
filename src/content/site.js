// URL scheme shared by the build (static pages, sitemap, hreflang) and the browser
// (links between pages, language switch). Pure.
//
// The default locale lives at the root ("/"); other locales under "/<code>/".
// Paths always end with "/" except query-string shells, which keep "?l=<id>".
// Page slugs and content slugs come from each locale file (slugs.*), so URLs are readable in
// every language and stable: changing a slug breaks inbound links, so add a redirect instead.

export const PAGE_KEYS = [
	"home",
	"lesson",
	"rhythm",
	"practice",
	"freePractice",
	"rhythmPractice",
	"pieces",
	"piece",
	"myPiece",
	"log",
	"devices",
	"settings",
	"glossary",
	"help",
	"about",
	"privacy",
	"accessibility",
	"licenses",
	"stream",
];

/** Pages that search engines may index (the rest are interactive shells). */
export const INDEXABLE = new Set(["home", "lesson", "rhythm", "pieces", "piece", "glossary", "help", "about", "privacy", "accessibility", "licenses"]);

export function makeSite({ locales, defaultLocale, dicts, siteUrl = "" }) {
	const prefix = (loc) => (loc === defaultLocale ? "" : `/${loc}`);
	const base = siteUrl.replace(/\/+$/, "");

	/** Path for a page in a locale. id = lesson/rhythm/piece id where needed. */
	function path(page, loc, id) {
		const s = dicts[loc].slugs;
		const p = prefix(loc);
		switch (page) {
			case "home":
				return `${p}/`;
			case "lesson":
				return `${p}/${s.pages.lessons}/${s.lessons[id]}/`;
			case "rhythm":
				return `${p}/${s.pages.rhythm}/${s.rhythm[id]}/`;
			case "piece":
				return `${p}/${s.pages.pieces}/${s.pieces[id]}/`;
			default: {
				const key = page === "rhythmPractice" ? "rhythmPractice" : page === "myPiece" ? "myPiece" : page;
				if (!s.pages[key]) throw new Error(`no slug for page ${page} in ${loc}`);
				return `${p}/${s.pages[key]}/`;
			}
		}
	}

	function abs(p) {
		return base ? `${base}${p}` : p;
	}

	/** Locale of a pathname (for the 404 page and the browser). */
	function localeOf(pathname) {
		const first = pathname.split("/")[1];
		return locales.includes(first) && first !== defaultLocale ? first : defaultLocale;
	}

	return { locales, defaultLocale, siteUrl: base, path, abs, localeOf };
}
