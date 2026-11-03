# AGENTS.md

Guide for AI coding assistants (and people) working in this repository. [CONTRIBUTING.md](CONTRIBUTING.md) has the rules that apply to everyone; this file adds what an agent needs to work safely.

## Purpose

Nuottitreeni is a browser app for learning to read sheet music with a MIDI keyboard: pre-rendered pages served by Cloudflare's asset layer, browser-side JavaScript for practice, and a small Worker for optional sync codes in D1. Users are beginners, so correct music facts and plain language matter more than features.

## Read order

1. This file.
2. [docs/architecture.md](docs/architecture.md): how the build, the browser code and the Worker fit together.
3. The doc for your task: [docs/adding-lessons.md](docs/adding-lessons.md), [docs/adding-pieces.md](docs/adding-pieces.md), [docs/translations.md](docs/translations.md), [docs/devices.md](docs/devices.md), [docs/api.md](docs/api.md), [docs/privacy-design.md](docs/privacy-design.md).
4. [docs/testing.md](docs/testing.md) before you run or change tests, and [docs/audit-checklist.md](docs/audit-checklist.md) before a release.

## Layout

| Path | What |
|---|---|
| `src/content/` | Language-neutral content (`catalog.js`: lessons, rhythm, pieces), locale strings (`locales/<lang>.js`), legal texts, licences, photos, generated icons |
| `src/core/` | Logic and browser modules: notes, staff renderer, explanations, progress format, sync codes, MIDI parsing and input adapters, sound, recorder, storage |
| `src/templates/` | HTML generation at build time (`layout.js`, `pages.js`) |
| `src/pages/` | Browser entry points, one per page type; `common.js` boots every page |
| `src/styles/main.css` | All styles and colour tokens |
| `src/sw.js` | Service worker template (the build fills in the file lists) |
| `worker/` | API Worker, security headers (single source for `_headers` too), rate limits |
| `migrations/` | D1 schema |
| `scripts/` | Build, asset generation (fonts, samples, icons, photos, OG images), SEO check, live proof, `serve.mjs` (hosting without Cloudflare) |
| `Dockerfile` | Builds the site and runs `scripts/serve.mjs` (sync off) |
| `tests/unit`, `tests/worker` | `node --test`, no dependencies; the Worker runs against a `node:sqlite` D1 shim |
| `tests/browser/` | Playwright flows, AAA matrix, SEO crawl, Lighthouse, review screenshots; own pinned `package.json` |
| `docs/` | Architecture, API, self-hosting, configuration, devices, privacy design, how-tos, decisions |

## Commands

```bash
npm ci
npm test                                       # unit + Worker tests; run after every change
npm run build                                  # dist/, fails on size budgets
npm run dev                                    # local site on http://127.0.0.1:8797 (with sync, local D1)
npm run serve                                  # built site on http://localhost:8080 without Cloudflare (sync off)
npm ci --prefix tests/browser --ignore-scripts
node tests/browser/run.mjs --only flows,aaa    # browser flows and the AAA matrix (needs Chromium)
node tests/browser/run.mjs --only flows,aaa --grep laitteet   # only matching flows and pages
node tests/browser/shots.mjs                   # screenshots in tests/browser/artifacts/review/ (--top, --bottom, --settings)
npm run check                                  # everything CI runs
```

## Contracts

All **stable**: a breaking change needs a major version, a migration and a CHANGELOG entry.

- Ids in `src/content/catalog.js` (lessons, rhythm lessons, pieces, modes) are stored in users' progress and on sync servers. Never rename or remove one; add a new id (`tests/unit/content.test.mjs` guards them).
- Storage keys `nt.v1.*` and the IndexedDB `nuottitreeni` stores (`src/core/store.js`, listed in [docs/privacy-design.md](docs/privacy-design.md)).
- Progress format v1 and its limits (`src/core/progress.js`), validated by both the browser and the Worker. The lesson id `free` (free practice) and the mode `name` were added in 1.1.0.
- Settings and per-device settings keep their names; new ones get defaults in `src/core/store.js` (1.2.0 added `noteColors`, `seenHelp` and the device `keys`).
- The sync API and error codes in [docs/api.md](docs/api.md), and the sync code format (`src/core/sync-code.js`).
- URL slugs in the locale files (`slugs`): public links and search results.
- Build variables and runtime variables in [docs/configuration.md](docs/configuration.md); self-hosters rely on their names.

The Bluetooth LE MIDI, USB vendor-mode and microphone inputs are **experimental** and may change without migration.

## Do not

- Do not state music facts without a test. Note names, staff positions, clefs and key signatures are checked against the staff model (`tests/unit/content.test.mjs`, `tests/unit/explain.test.mjs`).
- Do not add a string to one locale only. Finnish uses H for B and the -is/-es names.
- Do not write em dashes, emojis or stock phrases (`tests/copy-rules.json`).
- Do not leave a translation key unused (`tests/unit/repo-hygiene.test.mjs`): finish the feature or remove the key.
- Do not push to `main`: every change is a pull request that merges after CI ([decision 0011](docs/decisions/0011-stable-main.md)).
- Do not add a practice mode without its "How to practise" steps (`howto` in the locale files) and a test that names its buttons the same way.
- Do not add inline styles or scripts (the CSP blocks them), runtime dependencies or requests to other origins.
- Do not edit generated files by hand: `src/content/icons.js` (`npm run vendor:icons`), `src/assets/photos/` (`npm run build:photos`), fonts, samples, OG images, the vendored notation engine.
- Do not commit `.dev.vars`, real database ids, account ids or tokens. `wrangler.jsonc` keeps placeholder values for the Deploy button.
- Do not deploy from an agent session unless the person you work for asks.

## Dependencies

- Browser APIs: Web MIDI, Web Bluetooth, WebUSB, Web Audio, IndexedDB, service workers.
- Cloudflare Workers with static assets, D1 and a cron trigger; Wrangler 4 for development and deploys.
- Build: Node 24 (`.node-version`; 22 and 26 are tested in CI), esbuild. New dependency releases wait 14 days unless they fix a security advisory ([docs/release.md](docs/release.md#dependency-updates)). Tests: Node's test runner; Playwright, axe-core and Lighthouse in `tests/browser/`.
- Vendored third-party parts with their own licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Dependents

- Every deployed instance, including the official one at <https://piano.markussilvo.fi> and copies made with the Deploy button.
- Users' stored progress and sync records (see Contracts).

## Related decisions

[docs/decisions/](docs/decisions/README.md): browser only, sync codes per instance, static assets first, notation engines, input adapters, licences and assets, search defaults for copies, microphone input, piece practice aids, hosting without Cloudflare, stable main through pull requests.

## Alternatives

None beyond those recorded in the decisions.

## Documentation upkeep

| When you change | Also update |
|---|---|
| A lesson, piece or rhythm exercise | Both locale files; the content tests if facts change |
| A user-visible feature | `CHANGELOG.md` (Unreleased), README if it is a headline feature |
| Stored data, the API or a contract above | `docs/api.md` or `docs/privacy-design.md`, `PRIVACY.md`, the privacy notice in `src/content/legal.js`, `CHANGELOG.md` |
| A build or runtime variable | `docs/configuration.md`, `docs/self-hosting.md` |
| Device support | `docs/devices.md`, the help texts in the locale files |
| A third-party part | `THIRD_PARTY_NOTICES.md` and `src/content/licenses.js` |
| Tests or test commands | `docs/testing.md`, `docs/audit-checklist.md` |
| A practice mode or its buttons | The `howto` steps in both locale files (they name the buttons) |
| Colours | Tokens in `main.css` and the pair in `tests/unit/contrast.test.mjs` |
| A significant design choice | A new file in `docs/decisions/` |

## Changelog

[CHANGELOG.md](CHANGELOG.md) (Keep a Changelog, Semantic Versioning).

## Before you finish

Run `npm test` and `npm run build`. For anything visible, run the browser flows and the AAA matrix, look at the screenshots, and say what you did not verify.
