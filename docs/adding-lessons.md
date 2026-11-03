# Adding or changing a lesson

Lessons live in two places:

- `src/content/catalog.js`: the language-neutral part (id, staff, modes, the note pool, the example, the keyboard range).
- `src/content/locales/<lang>.js`: the words (`lessons.<id>`: title, description, the `learn` paragraphs, a hint) and the URL slug (`slugs.lessons.<id>`).

## Rules

- **Ids are permanent.** Users' progress and sync data refer to them, and the Worker rejects unknown ids. Never rename or remove an id. If a lesson changes meaning, add a new id and keep the old one (it can be hidden from the home page later).
- **One idea per lesson.** Explain it in plain words, show it in the example, then practise only that.
- **Facts are tested.** `tests/unit/content.test.mjs` recomputes the mnemonics and ledger-line statements from the staff model, and `tests/unit/explain.test.mjs` checks the miss explanations. If a text says where a note sits, the test must be able to check it.
- **Both languages.** Every key in one locale must exist in the other (the test fails otherwise). Finnish uses H for B and the -is/-es names (Fis, Es).

## Steps

1. Add the lesson object to `PITCH_LESSONS` in `src/content/catalog.js` at the right place in the teaching order. Look at the existing ones:

   ```js
   {
   	id: "treble-c4-g4",
   	staff: "treble",                 // "treble" | "bass" | "grand" | null (key names only)
   	modes: ["single", "row", "ear"], // which practice modes the lesson offers
   	range: ["C3", "B5"],             // keys drawn on the on-screen piano
   	pool: () => whiteRange("C4", "G4").map(onClef("treble")),
   },
   ```

   `example()` (optional) gives the notes shown with names on the guide page; without it, the pool is shown.

2. Add the texts in every locale: `lessons.<id>` with `title`, `description` (50 to 160 characters, it is also the search result text), `learn` (an array of short paragraphs) and `hint`; and `slugs.lessons.<id>` (lowercase, ASCII, hyphens).
3. Add the id to the frozen list in `tests/unit/content.test.mjs` (the test that guards ids).
4. Add the id to the allowed lessons for sync validation: it comes from `CATALOG_IDS` automatically, so nothing to do, but note that instances must deploy the new version before users of that lesson can sync.
5. Run `npm test`, `npm run build` and look at the guide page (`npm run dev`). Run the browser flows and the AAA matrix if the page layout changed.

## Rhythm lessons

`RHYTHM_LESSONS` in the same file: `quiz` (beats of a value or rest), `meter` (beats missing from a bar) and `tap` (patterns played against a metronome). Texts are under `rhythm.<id>`. Patterns use the compact notation described at the top of `src/core/notation.js`, and every bar must be complete (tested).
