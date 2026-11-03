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

`src/pages/common.js` boots every page: it loads the locale, applies the theme, creates the shared objects and returns a context.

| Module | Role |
|---|---|
| `core/input/hub.js` | One event stream (`note`, `pedal`, `status`) from all inputs; applies per-device settings (channel, octave, transpose, velocity curve) |
| `core/input/adapters.js` | Web MIDI, Bluetooth LE MIDI (Web Bluetooth) and USB vendor mode (WebUSB) |
| `core/input/parse.js` | Pure parsers for MIDI bytes, BLE-MIDI packets and USB-MIDI packets; the computer-keyboard map |
| `core/keyboard.js` | The on-screen piano (roving tab stop, arrow keys, marks) |
| `core/sound.js` | Sampler (nearest sample, pitch shift, release, sustain) and metronome on Web Audio |
| `core/staff.js` | SVG staff renderer used both at build time and in the browser |
| `core/explain.js` | Staff position maths behind the miss explanations |
| `core/progress.js` | Progress format v1: record, merge, validate, aggregate (shared with the Worker) |
| `core/store.js` | `localStorage` and IndexedDB access, guarded for blocked storage |
| `core/recorder.js` | Automatic MIDI recordings with idle detection |
| `core/sync.js`, `core/sync-code.js` | Sync client (merge and retry on conflict) and code format |
| `core/score.js` | Loads OpenSheetMusicDisplay only for imported MusicXML and MXL files |
| `core/smf.js`, `core/zip.js` | Standard MIDI File reader and writer, store-only ZIP writer |

Built-in pieces are drawn with the own staff renderer (`renderSystems` in `src/templates/pages.js` at build time, `src/pages/piece.js` in the browser). OpenSheetMusicDisplay (1.4 MB, about 360 KB compressed) is loaded only when the user opens their own MusicXML or MXL file.

## Worker (`worker/`)

`wrangler.jsonc` sets `run_worker_first: ["/api/*"]`, so the Worker runs only for the API; every other request is answered by the asset layer without a Worker invocation. The Worker validates progress data with the same code as the browser, stores sync records in D1 keyed by a hash of the code, enforces rate limits, and runs a daily cleanup from a cron trigger. The API contract is in [api.md](api.md).

## Service worker (`src/sw.js`)

- Pages: network first with a 3 second timeout, then the cache.
- Hashed assets: cache first.
- `/api/*`: never cached.
- Piano samples and the notation engine are cached in the background after install, or on request from Settings.
- Photos: only the smallest size of each is precached. Offline, another cached size of the same photo is served.

A new version is installed in the background, and the page offers an update button; nothing reloads by itself.

## Data and contracts

Stable, versioned contracts are listed in [AGENTS.md](../AGENTS.md#contracts). Storage keys and the data inventory are in [privacy-design.md](privacy-design.md). Decisions and their reasons are in [decisions/](decisions/README.md).
