# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Stored data (progress format, storage keys, sync API) changes only in a major version, with a migration.

## [Unreleased]

## [1.3.0] - 2026-11-04

New practice modes and piece tools, with ideas from three other piano trainers: sightread (GPL-3.0), Synthesia (commercial) and Midiano. Only ideas were taken. Everything is written from scratch for this MIT project, with its own tests ([decision 0012](docs/decisions/0012-features-from-other-trainers.md)). Two audit findings are fixed as well.

### Added

**New pages**
- **Phrases** (`/fraasit/`, `/en/phrases/`): short generated tunes, read and played like a note row.
  - Two bars of 4/4, mostly by step, starting and ending on the key note.
  - Four levels: steps between C4 and G4; then thirds and half notes; then fourths, or the bass clef; then both staffs and C, G and F major.
  - A round is five phrases, with misses explained and hints as in the lessons. The results are saved under new lesson ids `phrases-1` to `phrases-4`.
  - Idea: sightread's phrase training. Random note rows are hard to read as music; phrases move like real tunes.
- **Speed reading** (`/pikaluku/`, `/en/speed-reading/`): an optional timed game.
  - Every right answer shortens the time for the next note by 10 %. A miss or a timeout lengthens it and costs one of three tries.
  - Choose the clef, the range, the key signature and the start time (6, 4 or 2 s). Pause and Stop at any time.
  - The best notes per minute per clef are kept in this browser only.
  - Idea: sightread's speed training.
- **Explore notes** (`/tutki-nuotteja/`, `/en/explore-notes/`): play any key and see the note on a grand staff.
  - It shows the name, both spellings for black keys (Cis / Des) and the same tested explanation as in the drills.
  - Two notes give the interval ("suuri terssi"). Three or four give the chord with its inversion ("C-duuri, 1. käännös"): major, minor, diminished and augmented triads, and dominant, major and minor seventh chords.
  - Ideas: sightread's free play and Synthesia's chord labels.
- **More practice** on the home page and in the footer: free practice, phrases, speed reading and explore notes, in the free-practice colour. Phrases is also a shortcut in the installed app.

**Pieces**
- **Bass lines** for Ukko Nooa, Maijalla oli karitsa and Oodi ilolle: simple root notes in half and whole notes, on a two-staff score.
- **Play-along**: practise one hand and the app plays the other, in wait mode with your steps and in tempo mode with the metronome. It works for imported two-hand files too. Idea: sightread and Synthesia.
- **Another key**: built-in pieces can be played in any major or minor key with up to three sharps or flats.
  - The score, steps, text version and caption follow the key, and the choice is remembered per piece.
  - The transposer picks the direction that needs fewer ledger lines, so Ukko Nooa in G major goes up a fifth onto the staff instead of down below it. Idea: sightread.
- **Speed buttons**: 50 %, 75 % and 100 % of a suggested tempo for every piece. The slider stays for fine control and starts at 75 %.
- **Timing feedback** in tempo mode: how many notes were on time, early, late or missed, the wrong notes and the longest run on time. Idea: sightread's session stats.
- **Score and history**: every run gets a score from 0 to 100, and the last 10 runs of each piece are listed on its page. The page explains how the score works.
  - The history is stored only in this browser (`nt.v1.pieceRuns`) and is not synced.
  - Idea: Synthesia's progress scores.
- **Bar strip**: a button per bar. Press the first and the last bar to choose what to practise; the bar fields follow. Ideas: sightread's timeline and Midiano's loops.
- **Bar numbers** at the start of every score line. Idea: Midiano.
- **Labels on falling notes**: note names or finger numbers inside the bars, in black or white, whichever reads better on the bar's colour. Idea: Synthesia.
- **Full screen** for piece and drill pages: the practice area fills the screen (Esc returns). Not shown where the browser cannot do it. Idea: Midiano.

**Devices and display**
- **Colours by hand or finger**: the note colours setting is now a choice of off, by note name, by hand (right blue, left orange) or by finger (1 to 5), on the keys, the next-key marks and the falling notes. Two-hand pieces colour the falling notes by hand by default. Idea: Midiano.
- **Names on black keys** (setting, off by default), in the ♯ spelling, or ♭ in flat keys. Idea: Midiano.
- **Control keys** (Devices page, per instrument): teach two keys of your keyboard to start or stop practice and to start over, so you never leave the instrument. While set, those keys do not play in the exercises. They work on pieces, in rhythm tapping and in speed reading. Idea: Midiano.
- **Key lights** (experimental): keyboards with lighted keys can show the next notes of a piece, on a MIDI channel you choose, with a test button. Drills do not use it, because a lit key would give the answer away. Not yet tried with a real lighted keyboard. Idea: Synthesia.
- **The screen stays on** while an exercise runs (Screen Wake Lock), so a tablet on the music stand does not dim; a switch in Settings turns it off. Idea: sightread.
- **Run counter** in every drill: how many notes in a row were right, and the longest run in the round summary.
- **Glossary**: new entries for interval, chord, triad and inversion, the terms the explorer uses.

### Changed

- The piece page loads the falling notes, the transposer and the MIDI and MusicXML readers only when they are used, so its script stays under the 40 KB budget with all the new tools.
- **Faster first paint.** With the two-staff score, Ukko Nooa's largest paint had reached 1.83 s on Lighthouse's mobile run (budget 1.8 s). Two changes fixed it for every page:
  - Each page's language strings now reach the browser without the texts only the build uses (help answers, glossary, lesson explanations and descriptions, URL slugs, static page texts; `src/content/locale-browser.js`, guarded by `tests/unit/locale-browser.test.mjs`). The Finnish strings went from 18.6 to 12.1 KB, the English from 17.0 to 11.1 KB, and the home page's first load from 73.7 to 67.8 KB.
  - Page scripts start one frame after the first paint: the small theme script that already runs first adds the module script and its preloads (`data-entry`, `data-preload`). Everything visible is in the HTML, so the stylesheet and the fonts get the network first.
  - Result on Lighthouse's mobile run: the largest paint is now about 1.2 s on every budget page (Ukko Nooa 1.21 s instead of 1.83 s), layout shift 0, blocking time at most 42 ms; performance 100 everywhere (the home page had been 99).
- `Permissions-Policy` allows `screen-wake-lock` and `fullscreen` for the site itself.
- The rhythm tap uses the same timing judgment as the pieces (`src/core/timing.js`).
- A fieldset can no longer be widened by a long select, which made pages scroll sideways on phones with the new colour choice.

### Fixed

- **Piece results were saved but never shown.** Every finished run was recorded (times played, fewest wrong notes), but nothing displayed it. Piece cards on the Pieces page and the home page now show it.
- **The MIDI output did nothing for pieces.** "Output (sound to the instrument)" on the Devices page was used only by the ear drill; Listen never reached the instrument. All app playback now goes there too, and Stop silences it. The player's own notes are never echoed back.

### Developer

- **New pure modules with tests:**
  - `src/core/phrases.js`, `chords.js`, `transpose.js`, `timing.js`, `piece-text.js`, `color.js`
  - `pieceSteps()` and two-staff `systems()` in `notation.js`
  - `describeNote()` in `notes.js`
  - `controlAction()` in the input hub
  - per-note values and `barNumber` in the staff renderer
- **New browser helpers:** `src/core/wake-lock.js`, `src/core/key-lights.js`, `src/pages/fullscreen.js`.
- **Unit tests:**
  - new: `timing.test.mjs`, `phrases.test.mjs` (800 generated phrases), `transpose.test.mjs` (every piece in every key), `chords.test.mjs`
  - additions to the content, staff, notation, notes, contrast, headers and input tests
- **Browser suite:**
  - a flow for every new feature
  - the fakes record wake-lock requests and full-screen calls
  - the AAA matrix covers the new pages and settings combinations (`SETTINGS_BY_HASH`)
  - a failed flow prints its pages' console errors; a page that misses a Lighthouse budget gets its full report saved
- **Tools:** `npm run check:fresh` (`scripts/check-fresh.mjs`) runs `npm audit` and the whole gate in a fresh copy of the project; the build report names the largest page script (`maxPageJs`).

### Docs

- Decision 0012.
- Updated:
  - README in both languages
  - `docs/architecture.md`, `docs/adding-pieces.md` (bass lines, tempo, transposition), `docs/devices.md` (MIDI output playback, control keys, key lights, wake lock), `docs/api.md` (new lesson ids), `docs/privacy-design.md`, `docs/testing.md`
  - `PRIVACY.md` and the privacy notice (the piece history)
  - ACCESSIBILITY.md and the accessibility statement in the app (speed reading as an optional timed game)
  - `AGENTS.md` (contracts, the script budget, ideas-only rule)

## [1.2.1] - 2026-11-03

Fixes from a second audit pass after 1.2.0.

### Fixed

- **Reduced motion:** the falling notes scrolled smoothly even when the system asks for reduced motion, although the accessibility notes said it was respected (CSS cannot reach a canvas animation). They now move in whole-beat steps in that case.
- **Accessibility statement:** it said the site has "no moving or flashing parts and no time limits", which has not been true since the optional falling notes (1.1.0). It now names the falling notes, how they stop, and that the main exercises have no time limits; it also says that the optional note colours always come with the names.
- **Stream section on the Devices page:** it reused the stream page's own text, which says "open this page in its own window" (on the Devices page that pointed at the wrong page). It has its own text now, and the help answer says where the stream view is.
- **Settings page:** the footer showed a second theme choice under the one in Settings; the footer one is hidden there.
- **Pieces page:** pieces are listed easiest first (by level), so a level 1 piece no longer appears after level 2 pieces.
- **Piece steps:** "practise one hand at a time" is now said only for pieces with two hands.
- **Glossary:** fingering and solfège moved next to the terms they belong with; new entries for minor, metronome and count-in, words the app uses without explaining them.
- **Help:** "Does it cost anything?" now mentions copies on other servers and your own computer, not only Cloudflare.
- **Browsers without MIDI:** the message on the Devices page listed the on-screen keys and the computer keyboard but not the microphone, which is the main option in those browsers (Safari, iPhone, iPad).

## [1.2.0] - 2026-11-03

A release about being easy to start and easy to follow: a shorter header, steps and worked examples on every exercise, some colour, and the half-finished features from 1.1.0 completed. `main` now takes changes only through pull requests that passed CI.

### Added

- **How to start** on the home page: three numbered steps (connect an instrument or use the keys on the screen, read lesson 1, practise and see your progress) and a button straight to lesson 1. Before, a first-time visitor had to find the first lesson in a long list.
- **How to practise** box at the top of every exercise: single notes, the key-names lesson, a row of notes, by ear, naming the note, free practice, the rhythm quiz, playing a rhythm and pieces. Three or four numbered steps that name the real buttons, open on the first visit to each kind of exercise and closed after that (one click opens it again). The steps were written from what the code does: 20 notes per round, three rows of eight, the four-beat count-in, the 90% recommendation.
- **Example, step by step** on every staff lesson guide and in its exercises: one note on the staff, how to read it (the same tested sentences as the explanation after a miss: which line or space, what the clef makes of it, any sharp, flat or key signature), and the key marked on one octave. Each lesson has its own example note (`worked` in `src/content/catalog.js`), and a test checks that it belongs to the lesson.
- **Note colours** (Settings, off by default): C red, D orange, E yellow, F green, G blue, A indigo, B violet as a band on the white keys, on the falling notes and under the name buttons. The names always stay, so colour is never the only cue (WCAG 1.4.1); every colour has 3:1 contrast on the keys and the page in both themes.
- **Section colours**: lessons green, rhythm blue, pieces amber, free practice violet, on card top edges, section icons, step numbers and the current-page underline. 7:1 contrast in both themes, checked by the contrast test.
- **Keyboard size** per instrument on the Devices page (25, 37, 49, 61, 76 or 88 keys, each with the range it covers). The Yamaha DGX-205 and DGX-203 are recognised as 76 keys (E1 to G7). "I do not know" turns the warning off, even for a recognised model.
- **Range warning on pieces**: when the keyboard's size is known, the piece page names the notes that do not fit (after the octave shift and transpose) and points to the octave shift on the Devices page.
- **Restart** while practising a piece: the Practise button becomes "Start over" during a run.
- **Unplug message**: when a keyboard is unplugged, the device status says so by name (for example "Digital Keyboard was disconnected.") and offers Connect instrument again.
- **Works offline** line in the footer once everything is saved for offline use; announced to screen readers only the first time. The line's space is reserved, so nothing moves when it appears.
- **Stream view builder** on the Devices page: choose the background (green, black, transparent) and note names, and open the keyboard strip for OBS. Until now the stream page existed but nothing linked to it.
- **Stop** button for the rhythm tap exercise (ends the run without a score, for example to change the tempo), and the tempo slider grouped under "Metronome".
- **Octave keys** in the keyboard help text (Z: octave down, X: octave up); the keys worked before, but the help did not mention them.
- A metronome icon for the rhythm section (Phosphor, MIT).

### Changed

- **Header**: the brand, four main links (Lessons, Pieces, Practice log, Settings) and the language link. Below them, one line with the device status, one **Connect instrument** button and a link to the Devices page. Before, the header had seven links, a microphone toggle and a MIDI button, which wrapped to four rows on a phone.
- **Connect instrument** uses Web MIDI where the browser has it and the microphone where it does not (Safari, iPhone, iPad), so every browser gets one button that does something. The microphone switch moved to the Devices page; a microphone that was on still restarts on the next page without asking again.
- **Footer**: two groups, "Practice" (Devices, Free practice, Help, Glossary) and "About this site" (About, Privacy, Accessibility, Licences, Source code), then the theme choice.
- **Home page**: a shorter introduction; free practice has its own section and colour.
- On phones the language link sits next to the brand and the menu gets its own rows.
- Status texts say "instrument" instead of "MIDI device", because the microphone counts too; a browser without Web MIDI gets a short status line, and the long explanation stays on the Devices page.
- The help answer for "My keyboard does not show up" and the USB error point to the new Connect instrument button.

### Fixed

- Marked keys on static keyboards (the key-names lesson guide) showed two check marks (✓✓): since 1.1.0 the mark is drawn by CSS, and the HTML still had its own. The browser suite now fails when a mark is drawn twice.
- Piece practice in wait mode with "Repeat the chosen bars" on started again 1.2 seconds after you pressed Stop. Tempo mode already checked for this; wait mode does now too.

### Removed

- Ten translation strings that nothing used (for example `common.loading`, `pieces.open`). A test now fails on any unused string, so a feature cannot be left half-finished again.

### Security

- `main` is protected for everyone, the maintainer included: changes arrive as pull requests and merge (squash, linear history) only when `check`, Node 22 and Node 26 pass on an up-to-date branch with all conversations resolved; force pushes and deletion are blocked ([decision 0011](docs/decisions/0011-stable-main.md)).
- Dependabot ignores major versions of the Docker `node` image, so odd-numbered (never LTS) Node lines are not proposed; the Node 25 pull request was closed for that reason.

### Developer

- Lighthouse on CI sometimes reported performance 0 because Lighthouse itself crashed on a page; the suite now runs such a page once more and prints the error, so a flaky runner no longer blocks a pull request.
- `tests/unit/repo-hygiene.test.mjs`: every translation key is used, every relative Markdown link and `#anchor` resolves, every script in `scripts/` starts with a header comment.
- `tests/unit/keyboard-layout.test.mjs`: keyboard sizes, the DGX-205/203 size, playable ranges.
- Content and explain tests cover the how-to steps (same count in every locale) and the worked examples in both languages.
- Contrast test covers the section and note colours.
- Browser flows for the header, unplugging, the range warning, the stream link builder, the how-to box, note colours and the restart button; AAA pages with note colours on (`#note-colors`); `--grep` runs only matching flows and pages.
- `tests/browser/shots.mjs` takes `--top`, `--bottom` and `--height` for header, footer and README screenshots.
- The fake MIDI device can be unplugged (`window.__fakeMidi.unplug()`).
- `src/core/worked-example.js` (shared by the build and the browser) and `howTo()` in `src/pages/common.js`.

### Docs

- New: [docs/audit-checklist.md](docs/audit-checklist.md), the list to run before every release, and [decision 0011](docs/decisions/0011-stable-main.md).
- Updated: README in both languages, `docs/architecture.md` (layout, colours, the how-to box), `docs/devices.md` (keyboard size, the stream view, the new button), `docs/testing.md`, `docs/release.md` (releases through pull requests), `docs/privacy-design.md` (new settings), `CONTRIBUTING.md`, `AGENTS.md`.

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

### Developer

- Browser flows for free practice, the piece view options and print view, the microphone (a fake 440 Hz tone) and the PWA (Chromium's installability check, the manifest, every file cached, new pages and a photo offline). The AAA matrix covers free practice, name mode and the Chopin prelude.
- The design check also fails on broken output ("null", "undefined", a `{placeholder}` left in a string).
- Unit tests for pitch detection, `scripts/serve.mjs`, the cache and security headers, upbeats and bar lengths.

### Docs

- `docs/self-hosting.md`: other hosts, your own computer, Docker, HTTPS on a local network, and the Cloudflare zone features that can change pages. Decisions 0008 (microphone), 0009 (piece practice aids) and 0010 (hosting without Cloudflare). `docs/release.md`: dependency updates and the security exception.

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

[Unreleased]: https://github.com/Markus-web/nuottitreeni/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/Markus-web/nuottitreeni/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/Markus-web/nuottitreeni/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Markus-web/nuottitreeni/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Markus-web/nuottitreeni/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Markus-web/nuottitreeni/releases/tag/v1.0.0
