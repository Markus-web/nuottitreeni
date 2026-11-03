# Architecture

Nuottitreeni is a static, pre-rendered website with browser-side JavaScript and one small API Worker. There is no framework and no server-side rendering at request time.

```text
            build time                                   request time
 src/content + src/templates                 browser ── static assets (Cloudflare asset layer)
        │  scripts/build.mjs                    │          HTML, JS, CSS, fonts, samples, photos
        ▼                                       │
      dist/ ── wrangler deploy ──► Cloudflare ──┤
                                                └─ /api/* ──► Worker (worker/index.js) ──► D1
```

## Build (`scripts/build.mjs`)

1. Bundles the page entry points in `src/pages/` with esbuild (ES modules, code splitting, hashed file names). Locale files are separate chunks, loaded with a dynamic import, so a page only downloads its own language.
2. Bundles `src/styles/main.css` and the fonts it references.
3. Copies hashed static assets: icons, Open Graph images, piano samples (`src/assets/piano/`), photos (`src/assets/photos/`), the vendored notation engine (checked against its sha256) and the built-in pieces as MusicXML.
4. Renders every page in every locale with `src/templates/layout.js` and `src/templates/pages.js`. The default locale lives at `/`, the others under `/<code>/`. Lesson guides, rhythm guides, piece pages, the glossary, help and legal pages are complete HTML; interactive pages (practice, settings, devices, log) are shells with a heading and a `noscript` notice, filled in by JavaScript.
5. Writes `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, `manifest.webmanifest`, `_headers` (from `worker/headers.js`) and `sw.js` (from the `src/sw.js` template with the list of files to precache).
6. Fails when the landing page, the CSS or any page's JavaScript passes its gzip budget.

Each page embeds a small JSON block (`#nt-config`) with the page key, locale, asset URLs and paths, so the browser code never has to guess URLs.

## Browser code

`src/pages/common.js` boots every page: it loads the locale, applies the theme, creates the shared objects and returns a context. It also runs the device row in the header (status, one "Connect instrument" button that uses Web MIDI or, without it, the microphone, and an unplug message), the offline line in the footer, and `howTo()`, the "How to practise" box that every practice page shows (open on the first visit to each kind of practice, remembered in the `seenHelp` setting).

`src/pages/theme-init.js` runs before the first paint and sets the chosen theme and the note colours (`data-theme`, `data-note-colors` on `<html>`), so neither flashes.

### Layout and colour

- Header: the brand, four main links (lessons, pieces, practice log, settings), the language link, and the device row. Everything else is in the footer, in two groups (`FOOTER` in `src/templates/layout.js`).
- Section colours: the layout sets `data-section` on `<body>` (lessons green, rhythm blue, pieces amber, free practice violet); the home page sets it per section. They colour card top edges, section icons, step numbers and the current-page underline (`--section` in `main.css`).
- Note colours (setting, off by default): `--n-c` ... `--n-b` on the white keys (`data-step`), the falling notes and the name buttons. The names always stay.

| Module | Role |
|---|---|
| `core/input/hub.js` | One event stream (`note`, `pedal`, `status`) from all inputs; applies per-device settings (channel, octave, transpose, velocity curve) |
| `core/input/adapters.js` | Web MIDI, Bluetooth LE MIDI (Web Bluetooth) and USB vendor mode (WebUSB) |
| `core/input/mic.js`, `core/pitch.js` | Microphone input: pitch detection (YIN) and a note tracker; pauses while the app plays sound |
| `core/input/parse.js` | Pure parsers for MIDI bytes, BLE-MIDI packets and USB-MIDI packets; the computer-keyboard map |
| `core/keyboard.js` | The on-screen piano (roving tab stop, arrow keys, marks) |
| `core/sound.js` | Sampler (nearest sample, pitch shift, release, sustain) and metronome on Web Audio |
| `core/staff.js` | SVG staff renderer used both at build time and in the browser (note names below, finger numbers above) |
| `core/fingering.js` | Suggested right-hand fingering (five-finger positions chosen over the whole melody) |
| `core/falling.js` | Optional falling-notes view on a canvas above the on-screen keyboard |
| `core/explain.js` | Staff position maths behind the miss explanations |
| `core/worked-example.js` | The "Example, step by step" walk-through (staff, reading steps from `explain.js`, the key on one octave), shared by the lesson guides (build) and the practice pages |
| `core/keyboard-layout.js` | Key layout for the on-screen and static keyboards; keyboard sizes, known models (DGX-205/203: 76 keys) and the playable range used by the range warning on pieces |
| `core/progress.js` | Progress format v1: record, merge, validate, aggregate (shared with the Worker) |
| `core/store.js` | `localStorage` and IndexedDB access, guarded for blocked storage |
| `core/recorder.js` | Automatic MIDI recordings with idle detection |
| `core/sync.js`, `core/sync-code.js` | Sync client (merge and retry on conflict) and code format |
| `core/score.js` | Loads OpenSheetMusicDisplay only for imported MusicXML and MXL files |
| `core/smf.js`, `core/zip.js` | Standard MIDI File reader and writer, store-only ZIP writer |

Built-in pieces are drawn with the own staff renderer (`renderSystems` in `src/templates/pages.js` at build time, `src/pages/piece.js` in the browser). OpenSheetMusicDisplay (1.4 MB, about 360 KB compressed) is loaded only when the user opens their own MusicXML or MXL file.

## Worker (`worker/`)

`wrangler.jsonc` sets `run_worker_first: ["/api/*"]`, so the Worker runs only for the API; every other request is answered by the asset layer without a Worker invocation. The Worker validates progress data with the same code as the browser, stores sync records in D1 keyed by a hash of the code, enforces rate limits, and runs a daily cleanup from a cron trigger. The API contract is in [api.md](api.md).

## Without Cloudflare

`scripts/serve.mjs` serves `dist/` with the same headers and answers `/api/config` with sync turned off; the `Dockerfile` builds the site and runs that server. Any static host works the same way: the app treats a missing sync API as "sync not available". See [self-hosting.md](self-hosting.md#other-hosts-without-sync-codes) and [decision 0010](decisions/0010-hosting-without-cloudflare.md).

## Service worker (`src/sw.js`)

- Pages: network first with a 3 second timeout, then the cache.
- Hashed assets: cache first.
- `/api/*`: never cached.
- Piano samples and the notation engine are cached in the background after install, or on request from Settings.
- Photos: only the smallest size of each is precached. Offline, another cached size of the same photo is served.

A new version is installed in the background, and the page offers an update button; nothing reloads by itself.

## Data and contracts

Stable, versioned contracts are listed in [AGENTS.md](../AGENTS.md#contracts). Storage keys and the data inventory are in [privacy-design.md](privacy-design.md). Decisions and their reasons are in [decisions/](decisions/README.md).
