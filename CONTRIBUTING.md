# Contributing

Thanks for helping. Nuottitreeni is meant for people who are just starting to read music, so the most valuable contributions are often small: a clearer sentence in a lesson, a translation, a public-domain melody, or a report that a keyboard works (or does not).

By contributing you agree that your contribution is published under the [MIT licence](https://github.com/Markus-web/nuottitreeni/blob/main/LICENSE). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

| You want to | Start here |
|---|---|
| Report a bug | [Bug report](https://github.com/Markus-web/nuottitreeni/issues/new?template=bug.yml) |
| Tell us how your keyboard works | [Device report](https://github.com/Markus-web/nuottitreeni/issues/new?template=device-report.yml); the Devices page in the app writes the report text for you |
| Translate the app | [docs/translations.md](docs/translations.md) |
| Add a piece | [docs/adding-pieces.md](docs/adding-pieces.md) |
| Improve or add a lesson | [docs/adding-lessons.md](docs/adding-lessons.md) |
| Ask or suggest something | [Discussions](https://github.com/Markus-web/nuottitreeni/discussions) |
| Report a security problem | [SECURITY.md](SECURITY.md), privately |

## Set up

You need Node 22 and npm.

```bash
git clone https://github.com/Markus-web/nuottitreeni.git
cd nuottitreeni
npm ci
npm run dev      # http://127.0.0.1:8797 with a local D1 database
```

`npm run dev` builds the site into `dist/`, applies the D1 migrations locally and starts `wrangler dev`. After changing files, stop it and run it again (the build is fast).

## Before you open a pull request

```bash
npm test         # unit and Worker tests, includes the writing rules and contrast checks
npm run build    # fails if a page or script grows past its size budget
```

If you changed anything people see or use, also run the browser suite. It needs Chromium (set `CHROMIUM_PATH` if it is not `/usr/bin/chromium`) and its own pinned packages:

```bash
npm ci --prefix tests/browser --ignore-scripts
npm run test:browser          # or: node tests/browser/run.mjs --only flows,aaa
```

`npm run check` runs everything in the order CI does. [docs/testing.md](docs/testing.md) explains each part.

`main` is protected: pull requests merge only when CI (the `check` job) passes, and force pushes are blocked. Dependency updates wait until a release is at least 14 days old.

Keep pull requests small and about one thing. Describe what changed and why; screenshots help for visual changes. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`fix: ...`, `feat: ...`, `docs: ...`).

## Writing

The readers are beginners, often children or adults who have never read music.

- Plain words and short sentences. Explain a music term the first time it appears and add it to the glossary.
- Say what to do, not how great something is. No marketing tone.
- No em dashes, no emojis. `tests/copy-rules.json` lists the phrases the tests reject; most are stock phrases that make text sound machine-written.
- Finnish and English say the same thing. Every key must exist in every locale (the tests check it).
- Note facts are checked against the staff model in `tests/unit/content.test.mjs`. If you write "the note on the middle line", the test knows which note that is.

## Accessibility

The target is WCAG 2.2 AAA. In practice:

- Text contrast 7:1 or more, borders and focus rings 3:1, in both themes. Add new colours as tokens in `src/styles/main.css` and add the pair to `tests/unit/contrast.test.mjs`.
- Every control at least 44 by 44 pixels, reachable and usable with the keyboard, with a visible focus ring.
- Never show a state with colour alone: add a mark (the app uses the plain characters ✓ and ✗) or text.
- No time limits in the main exercises; timed modes are optional and have an untimed alternative.
- No moving, blinking or auto-playing content. Layout must not shift after load.
- Images need alt text; music needs a text alternative.

The AAA matrix in the browser suite checks most of this on every page in both themes at 320 and 1280 pixels.

## Code

- Plain JavaScript modules, no framework. Pages are rendered to HTML at build time (`src/templates/`); `src/pages/` adds the interactive parts in the browser.
- No new runtime dependencies or third-party requests without a discussion first. The Content Security Policy allows only this site's own origin, and the privacy promise depends on it.
- Stable contracts: lesson, rhythm and piece ids, storage keys (`nt.v1.*`), the progress format and the sync API are used by stored data. Never rename them; add new ones. See [docs/architecture.md](docs/architecture.md) and [docs/api.md](docs/api.md).
- Keep comments short and about why, in the style of the surrounding code.

## AI-assisted contributions

They are welcome under the same rules. Read [AGENTS.md](AGENTS.md) first, check every fact about music yourself, and run the tests.
