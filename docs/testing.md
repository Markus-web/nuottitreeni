# Testing

Three layers, from fast to thorough. CI (`.github/workflows/ci.yml`) runs all of them on every push and pull request.

## 1. Unit and Worker tests: `npm test`

`node --test tests/unit tests/worker`, no dependencies beyond Node 22. About two seconds plus two builds.

| File | Covers |
|---|---|
| `tests/unit/notes.test.mjs` | Note names (letters and the H system), MIDI numbers, spelling |
| `tests/unit/explain.test.mjs` | Staff positions and the miss explanations |
| `tests/unit/content.test.mjs` | Lesson facts recomputed from the staff model, frozen ids, locale parity for every locale file, slugs, piece bars and ranges, rhythm answers |
| `tests/unit/staff.test.mjs` | The SVG staff renderer |
| `tests/unit/progress.test.mjs` | Progress format: record, merge, every validation limit |
| `tests/unit/sync-code.test.mjs` | Code generation, normalization, hashing |
| `tests/unit/smf-zip-notation.test.mjs` | MIDI file reader and writer, ZIP writer, the compact notation and MusicXML output |
| `tests/unit/input-parse.test.mjs` | Web MIDI, BLE-MIDI and USB-MIDI parsers, velocity curves, the computer-keyboard map |
| `tests/unit/i18n.test.mjs` | Lookups, placeholders, number and date formats per locale |
| `tests/unit/contrast.test.mjs` | Colour tokens in `main.css`: 7:1 text, 3:1 boundaries and focus, both themes |
| `tests/unit/copy.test.mjs` | Writing rules (`tests/copy-rules.json`) on UI strings, legal texts and Markdown docs |
| `tests/unit/headers.test.mjs` | CSP, Permissions-Policy and the generated `_headers` |
| `tests/unit/build-output.test.mjs` | Two builds into temporary directories (an indexable instance and the deploy-button defaults): routes per locale, every local URL resolves, sitemap equals the indexable pages, `noindex` on clones, service worker lists, `_headers` |
| `tests/worker/api.test.mjs` | Every API route and error, rate limits, salt bootstrap, Origin check, `SYNC_ENABLED`, cleanup; runs the Worker against a `node:sqlite` D1 shim (`tests/helpers/d1-sqlite.mjs`) with the real migration |

## 2. Build: `npm run build`

Fails when the landing page (HTML, CSS, scripts, fonts and the home photo) is over 120 KB compressed, the CSS over 15 KB, or any page's JavaScript over 40 KB.

## 3. Browser suite: `npm run test:browser`

`tests/browser/run.mjs` builds the site with a test configuration (`TEST_SITE` in `tests/browser/lib/server.mjs`), runs it with `wrangler dev` and a local D1, and drives Chromium with Playwright.

Setup once:

```bash
npm ci --prefix tests/browser --ignore-scripts
export CHROMIUM_PATH=/usr/bin/chromium      # or google-chrome
```

Parts (`--only` takes a comma-separated list):

| Part | What |
|---|---|
| `flows` | Web MIDI permission states (granted, denied, unsupported); the Bluetooth and USB adapters, MIDI monitor and device report with fake devices; a drill with a miss and a full round, a round with the computer keyboard only, row and ear modes; a rhythm quiz and a tap round; a piece in wait mode; importing MIDI, MusicXML and MXL; a recording and its download; export and import with merge; a sync code linking two browsers and deleting the server copy; offline use; the stream page. Revision conflicts are covered by the Worker tests |
| `aaa` | The WCAG 2.2 AAA matrix: each page type in both languages, dark and light, at 320 and 1280 pixels: axe (A, AA, AAA, best practices), target sizes, focus rings, skip link, headings, reflow, text spacing, animations, design rules, console errors and CSP violations; plus a drill in forced colours |
| `seo` | Crawl of `dist/`: titles, descriptions, canonical, reciprocal `hreflang`, JSON-LD, broken links, sitemap, robots, `llms.txt` (`scripts/check-seo.mjs`) |
| `lighthouse` | Mobile and desktop on five pages: Performance at least 95, the other categories 100, LCP at most 1.8 s, CLS at most 0.02, TBT at most 100 ms |
| `template` | A build with the deploy-button defaults: English first, `noindex`, operator read from `/api/config` |

Results and screenshots go to `tests/browser/artifacts/` (ignored by Git). Add `--no-build` to reuse the current test build.

For a visual review, `node tests/browser/shots.mjs` saves full-page screenshots of the main pages (both themes, 320 and 1280 pixels) to `tests/browser/artifacts/review/`; pass paths, `--widths` and `--themes` to choose. The README screenshot (`docs/images/home.png`) is the top 840 pixels of `node tests/browser/shots.mjs --widths 1280 --themes dark /en/`.

## Live check

`npm run prove:live -- --base https://your.domain [--browser]` checks a deployed instance (see [self-hosting.md](self-hosting.md#checking-a-deployment)).

## What is not automated

Screen reader use (NVDA, VoiceOver, Orca), real Bluetooth and vendor-USB keyboards, Firefox's MIDI permission flow, and Safari and iOS behaviour. Report results in an issue; they are listed in [ACCESSIBILITY.md](../ACCESSIBILITY.md) and [devices.md](devices.md).
