# Testing

Three layers, from fast to thorough. CI (`.github/workflows/ci.yml`) runs all of them on every push and pull request.

## 1. Unit and Worker tests: `npm test`

`node --test "tests/unit/*.test.mjs" "tests/worker/*.test.mjs"` (quoted globs, expanded by Node 22 and later), no dependencies beyond Node 22. About two seconds plus two builds.

| File | Covers |
|---|---|
| `tests/unit/notes.test.mjs` | Note names (letters and the H system), MIDI numbers, spelling |
| `tests/unit/explain.test.mjs` | Staff positions, the miss explanations and the worked examples ("Example, step by step") in both languages |
| `tests/unit/content.test.mjs` | Lesson facts recomputed from the staff model, frozen ids, locale parity for every locale file (including the step counts of the "How to practise" boxes), slugs, piece bars and ranges, rhythm answers, worked-example notes that belong to their lesson |
| `tests/unit/keyboard-layout.test.mjs` | Keyboard sizes (each covers its number of keys), the known DGX-205/203 size, playable range with octave shift and transpose |
| `tests/unit/repo-hygiene.test.mjs` | Every translation key is used, every relative Markdown link and `#anchor` resolves, every script in `scripts/` starts with a header comment |
| `tests/unit/staff.test.mjs` | The SVG staff renderer |
| `tests/unit/progress.test.mjs` | Progress format: record, merge, every validation limit |
| `tests/unit/sync-code.test.mjs` | Code generation, normalization, hashing |
| `tests/unit/smf-zip-notation.test.mjs` | MIDI file reader and writer, ZIP writer, the compact notation and MusicXML output |
| `tests/unit/input-parse.test.mjs` | Web MIDI, BLE-MIDI and USB-MIDI parsers, velocity curves, the computer-keyboard map |
| `tests/unit/i18n.test.mjs` | Lookups, placeholders, number and date formats per locale |
| `tests/unit/contrast.test.mjs` | Colour tokens in `main.css`: 7:1 text, 3:1 boundaries and focus, the section colours (7:1) and the note colours (3:1 on keys and pages), both themes |
| `tests/unit/copy.test.mjs` | Writing rules (`tests/copy-rules.json`) on UI strings, legal texts and Markdown docs |
| `tests/unit/pitch.test.mjs` | Microphone pitch detection on synthetic tones (pure and piano-like), noise and silence; the note tracker |
| `tests/unit/serve.test.mjs` | `scripts/serve.mjs`: headers, folder index, trailing-slash redirect, 404 page, path traversal, sync-off API |
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
| `flows` | The header (four tasks, one connect button, the rest in the footer, the "How to start" link); Web MIDI permission states (granted, denied, unsupported: the button offers the microphone) and unplugging a keyboard; the keyboard size and the range warning on a piece; the stream link builder; the "How to practise" box (open on the first visit only); note colours; the restart button on pieces; the Bluetooth and USB adapters, MIDI monitor and device report with fake devices; a drill with a miss and a full round, a round with the computer keyboard only, row and ear modes; a rhythm quiz and a tap round; a piece in wait mode; importing MIDI, MusicXML and MXL; a recording and its download; export and import with merge; a sync code linking two browsers and deleting the server copy; offline use; the stream page; free practice with the keyboard only (name buttons, a hint); note names, fingering, falling notes and the print view on a piece; the microphone with a fake 440 Hz tone; the PWA (Chromium's installability check, the manifest, every file cached, new pages, a piano sample and a photo offline). Revision conflicts are covered by the Worker tests |
| `aaa` | The WCAG 2.2 AAA matrix: each page type in both languages, dark and light, at 320 and 1280 pixels (paths ending in `#note-colors` with note colours and falling notes on): axe (A, AA, AAA, best practices), target sizes, focus rings, skip link, headings, reflow, text spacing, animations, design rules, broken text ("null", "undefined", `{placeholder}`), key marks drawn twice, console errors and CSP violations; plus a drill in forced colours |
| `seo` | Crawl of `dist/`: titles, descriptions, canonical, reciprocal `hreflang`, JSON-LD, broken links, sitemap, robots, `llms.txt` (`scripts/check-seo.mjs`) |
| `lighthouse` | Mobile and desktop on five pages: Performance at least 95, the other categories 100, LCP at most 1.8 s, CLS at most 0.02, TBT at most 100 ms. A page is run once more when Lighthouse itself reports a runtime error (a flaky CI runner, not a slow page); the error is printed |
| `template` | A build with the deploy-button defaults: English first, `noindex`, operator read from `/api/config` |

Results and screenshots go to `tests/browser/artifacts/` (ignored by Git). Add `--no-build` to reuse the current test build, and `--grep <text>` to run only the flows and AAA pages whose name contains the text (while fixing something).

For a visual review, `node tests/browser/shots.mjs` saves full-page screenshots of the main pages (both themes, 320 and 1280 pixels) to `tests/browser/artifacts/review/`; pass paths, `--widths` and `--themes` to choose. `--top` or `--bottom` saves only the first or last screenful (header or footer review) and `--settings '{"noteColors":true}'` turns settings on first. The README screenshot (`docs/images/home.png`) is `node tests/browser/shots.mjs --top --height 840 --widths 1280 --themes dark /en/`, copied from `tests/browser/artifacts/review/_en_-dark-1280.png`.

## CI

`.github/workflows/ci.yml` runs `npm audit` (root and `tests/browser`), the unit tests, the build, a dry-run deploy and the browser suite on Node 24 (`.node-version`), and the unit tests and build on Node 22 and 26. `main` is protected: every change arrives as a pull request and merges only when `check` and both Node jobs pass ([decision 0011](decisions/0011-stable-main.md)). Before a release, go through the [audit checklist](audit-checklist.md).

## Live check

`npm run prove:live -- --base https://your.domain [--browser]` checks a deployed instance (see [self-hosting.md](self-hosting.md#checking-a-deployment)).

## What is not automated

Screen reader use (NVDA, VoiceOver, Orca), real Bluetooth and vendor-USB keyboards, Firefox's MIDI permission flow, and Safari and iOS behaviour. Report results in an issue; they are listed in [ACCESSIBILITY.md](../ACCESSIBILITY.md) and [devices.md](devices.md).
