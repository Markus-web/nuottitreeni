# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Stored data (progress format, storage keys, sync API) changes only in a major version, with a migration.

## [Unreleased]

## [1.1.0] - 2026-11-03

### Added

- Free practice: choose the clef (treble, bass or both), the note range, the key signature (up to three sharps or flats) and whether sharps and flats appear; the settings are kept in the address, so a practice can be bookmarked.
- Name the note: a fourth practice mode in every staff lesson and in free practice. Choose the note's name from buttons (letter keys work while the buttons have focus); works without an instrument and with a screen reader.
- Hint button in practice rounds: explains the note before you answer (a hinted note counts as a miss, so it comes back more often).
- Note names in solfège (Do Re Mi), next to letters and the Finnish H system, chosen in Settings.
- Piece view options: note names and suggested fingering on the score, falling notes above the keyboard (off by default, moving only while playing), marks on the next keys, and printing the score.
- Looping in tempo mode: the chosen bars start again with a new count-in.
- Microphone input (experimental): play an acoustic piano or sing; one note at a time, recognised in the browser and never recorded or sent. Works on iPhone and iPad too.
- Five new pieces: Brahms's Lullaby, Jingle Bells, Lightly Row (Hänschen klein), the Für Elise theme and the opening of Chopin's Prelude in E minor (Op. 28 No. 4). Pieces can start with an upbeat and be in a minor key.

- Hosting without Cloudflare: `npm run serve` (`scripts/serve.mjs`, Node only, same security headers, sync off) and a `Dockerfile`; Netlify, Cloudflare Pages, GitHub Pages and other static hosts documented in `docs/self-hosting.md`.
- Web app manifest: `id` and shortcuts to free practice, pieces and the practice log.

### Changed

- Permissions-Policy allows the microphone for the site itself (`microphone=(self)`).
- The microphone pauses while the app plays sound itself (Listen, ear training), so it never answers for you.
- Answer marks on the on-screen keys are drawn by CSS, so each key's visible text matches its accessible name (WCAG 2.5.3, found by axe-core 4.14).
- Node 24 is the default (`.node-version`); CI also tests Node 22 and 26 and runs `npm audit`. Test tools: Playwright 1.64.1, axe-core 4.14.0. Wrangler stays at 4.153.0, the first release without the `undici` advisories. Dependabot waits 14 days for new releases.
- A host without the sync API (static hosting) now shows "sync not available" instead of sync controls that cannot work.
- Pages are served with `Cache-Control: no-transform`, so Cloudflare zone features (Web Analytics, Zaraz, Rocket Loader) cannot inject scripts into them. `prove:live` checks a page fetched as a browser and accepts zone security headers that are at least as strict as the app's.
- The device row keeps space for a wrapped second line on narrow screens, so nothing moves when the connect button appears.

### Fixed

- A stray "null" text above the bar fields on pieces without a left-hand part.
- `npm test` works on Node 22 (quoted test globs).
- A WebUSB "Access denied" error now explains that the computer's own MIDI driver already uses the keyboard and points to Connect MIDI device.

## [1.0.0] - 2026-11-03

First public release.

### Added

- Ten pitch lessons from key names to key signatures, each with an explanation, a written-out example and three practice modes (single notes, a row of notes, by ear). Misses explain the line or space, the clef and any sharp, flat or key signature.
- Four rhythm lessons: note values, rests and time signatures as untimed quizzes, and tapping rhythms with a metronome (40 to 120 beats per minute).
- Six built-in public-domain pieces with wait and tempo modes, hands, bar ranges, looping and a listen mode; import of MusicXML, MXL and MIDI files that stay in the browser.
- MIDI input through Web MIDI, Bluetooth LE MIDI (Web Bluetooth, experimental) and USB vendor mode (WebUSB, experimental), plus the on-screen and computer keyboard. Per-keyboard settings: channel, octave, transpose, velocity curve, split point, MIDI output, Local Control and All Notes Off. A device page with a MIDI monitor, latency check and a device report.
- Piano sound from FluidR3_GM samples, automatic MIDI recordings, practice log with daily minutes, streak and goal, ZIP and CSV export.
- Offline use and installation as an app (service worker, web app manifest).
- Optional sync codes per instance (Cloudflare Worker and D1), export and import of progress as JSON.
- Finnish and English, with the Finnish note names (H, Cis, Es) and the international ones.
- WCAG 2.2 AAA target with automated checks, privacy notice and accessibility statement in both languages.
- Phosphor icons in the menu and on buttons, and four photos from Unsplash with credits under each photo.
- Deploy to Cloudflare button, documentation for self-hosting, and a test suite (unit, Worker API, browser flows, AAA matrix, SEO crawl, Lighthouse budgets).

[Unreleased]: https://github.com/Markus-web/nuottitreeni/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Markus-web/nuottitreeni/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Markus-web/nuottitreeni/releases/tag/v1.0.0
