// The part of a locale file that the browser needs. Every page loads its language's strings, so
// long texts that only the build uses (help answers, the glossary, lesson explanations and
// descriptions, URL slugs, the texts of static pages) are left out of the browser's copy; the
// build writes them into the HTML. tests/unit/locale-browser.test.mjs checks that browser code
// never reads what is left out.

/** Top-level sections used only by the build (templates, sitemap, llms.txt). */
export const BUILD_ONLY_SECTIONS = ["help", "glossary", "slugs", "about", "glossaryPage", "helpPage", "licensesPage", "notFound", "photos"];

/** Fields of each item in these sections that only the build uses. */
export const BUILD_ONLY_FIELDS = { lessons: ["learn", "description"], rhythm: ["learn", "description"], piecesMeta: ["description"] };

/** A copy of a locale dictionary without the build-only texts. */
export function browserLocale(dict) {
	const out = {};
	for (const [key, value] of Object.entries(dict)) {
		if (BUILD_ONLY_SECTIONS.includes(key)) continue;
		const fields = BUILD_ONLY_FIELDS[key];
		out[key] = fields ? Object.fromEntries(Object.entries(value).map(([id, item]) => [id, Object.fromEntries(Object.entries(item).filter(([f]) => !fields.includes(f)))])) : value;
	}
	return out;
}
