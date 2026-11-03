# Translations

The app ships in Finnish and English. Each language is one file, `src/content/locales/<code>.js`, plus the legal texts in `src/content/legal.js`.

## Adding a language

1. Copy `src/content/locales/en.js` to `src/content/locales/<code>.js` (ISO 639-1 code, for example `sv` or `de`).
2. Translate every string. Keep the keys and the placeholders in braces (`{name}`, `{n}`) as they are.
3. Set `meta`: `locale`, `tag` (a BCP 47 tag used for number and date formats, for example `sv-SE`), `name` (the language's own name), `ogLocale` (for example `sv_SE`), `noteNames` (`letters` for C D E F G A B, or `h-system` for the German and Nordic system with H and -is/-es) and `switchLabel` (the link text in the header, written in the new language, for example `På svenska`).
4. Translate the slugs (`slugs.pages`, `slugs.lessons`, `slugs.rhythm`, `slugs.pieces`): lowercase ASCII with hyphens. Slugs are part of public URLs; do not change them after release.
5. Add the privacy notice and accessibility statement to `src/content/legal.js` under the new code. Until then the English text is used.
6. Build with the language: `NT_LOCALES=en,fi,<code> npm run build`. The language is served under `/<code>/`.
7. Run `npm test`: it checks every locale file against English (missing or extra keys, lesson paragraph counts, slugs) and the writing rules.

## Style

- Write for a beginner in plain words. Use the music terms that teachers in your language use, and explain each one the first time (the glossary lists them).
- Check note names and staff facts against a music theory book in your language; the English text is not always a word-for-word guide (for example, Finnish says a note sits "viivalla", on the line, where a literal translation of English would be wrong).
- No em dashes or emojis (tested).

## Updating a translation

When a text is added in English or Finnish, the parity test fails until every language has the new key. The person who adds the text adds it to every locale (a machine translation marked in the pull request is fine as a start); translators then improve it. Open an issue with the `translation` label when a language needs a review.
