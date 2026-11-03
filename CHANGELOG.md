# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Stored data (progress format, storage keys, sync API) changes only in a major version, with a migration.

## [Unreleased]

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

[Unreleased]: https://github.com/Markus-web/nuottitreeni/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Markus-web/nuottitreeni/releases/tag/v1.0.0
