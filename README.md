# Nuottitreeni (Note Trainer)

A free web app for learning to read sheet music and play it on a piano or keyboard. It runs in the browser, works with almost any MIDI keyboard, keeps working offline and stores your progress only in your own browser. Finnish and English.

**Use it free at <https://piano.markussilvo.fi>.** That is the official instance, run by the author. You can also run your own copy on Cloudflare with one button (see below).

[Suomeksi](README.fi.md)

![The English home page: the menu, the Connect instrument button and the three How to start steps](docs/images/home.png)

## What it does

- **Easy to start.** The home page shows three steps: connect an instrument (or use the keys on the screen), read lesson 1, practise. Every exercise opens with a short "How to practise" box the first time, with numbered steps and a worked example: the note on the staff, how to read it, and the key to play.
- **Lessons for reading notes.** Ten short lessons from the key names to the treble and bass clef, ledger lines, sharps and flats and key signatures. Each lesson explains the idea in plain words with a written-out example, then you practise: one note at a time, a row of notes, by ear, or by naming the note from buttons (no instrument needed). When you miss, or ask for a hint, the app tells you why (which line or space, what the clef makes of it).
- **Free practice.** Pick the clef, the note range, the key signature and whether sharps and flats appear, and drill exactly the notes you need.
- **More practice.** Phrase training: short generated tunes in four levels, read and played like music. Speed reading: an optional timed game where every right answer makes the next note faster. Explore notes: play any key, or several, and see the note on the staff with its name, or the interval or chord (C major, first inversion).
- **Note names your way.** Letters (C D E), the Finnish and German H system (C D E ... A H) or solfège (Do Re Mi). Optional colours by note name (C red, D orange, E yellow and so on), by hand or by finger, on the keys, the falling notes and the name buttons, and names on the black keys too; the names always stay.
- **Rhythm.** Note values, rests and time signatures as untimed quizzes, and tapping rhythms with a metronome.
- **Pieces.** Eleven built-in public-domain melodies, from Ukko Nooa and Twinkle Twinkle to the Für Elise theme and the opening of Chopin's Prelude in E minor, to play from the score. The app waits for the right note, or follows a tempo you choose (with speed buttons for 50, 75 and 100 % of a suggested tempo), and can loop the bars you choose on a bar strip. Three pieces have a bass line: practise one hand and the app plays the other. Play any built-in piece in another key. Tempo mode tells you which notes were on time, early or late, and every run gets a score that is kept in a short history. Show note names and suggested fingering on the score, falling notes above the keyboard (with names or finger numbers), colours by note, hand or finger, bar numbers, or practise in full screen and print the score. You can also open your own MusicXML, MXL or MIDI files; they never leave your browser.
- **Your keyboard.** USB and Bluetooth MIDI keyboards through Web MIDI. Bluetooth LE MIDI and some older USB keyboards (for example Yamaha models in the maker's own USB mode) can be connected directly in Chromium browsers (experimental). The on-screen keyboard and your computer keyboard always work, and an acoustic piano (or your voice) works through the microphone, one note at a time; the sound is analysed in the browser and never recorded or sent. Tell the app your keyboard's size (the Yamaha DGX-205 is recognised) and a piece tells you which notes do not fit. Two keys of your keyboard can start, stop and restart practice, keyboards with lighted keys can show the next notes (experimental), and the app's playback can sound on your instrument through MIDI out. The screen stays on while you practise. A stream view shows your playing on a keyboard strip for OBS.
- **Sound, recordings and a practice log.** Piano sound in the browser, automatic recordings of what you play (download them as MIDI files), minutes per day and an optional daily goal.
- **Offline and installable.** After the first visit the app works without a network and can be installed as an app.
- **Accessible.** WCAG 2.2 AAA is the target: 7:1 contrast, large targets, full keyboard use, no time limits in the main exercises, text alternatives for the notation. See [ACCESSIBILITY.md](ACCESSIBILITY.md).
- **Private by design.** No accounts, cookies, analytics, ads or third-party requests. An optional sync code copies your progress between devices through the instance's own server, which stores practice statistics and nothing else. See [PRIVACY.md](PRIVACY.md).

## Which browsers and keyboards work

| Browser | MIDI keyboard | What else |
|---|---|---|
| Chrome, Edge, Opera, Brave on Windows, macOS, Linux and ChromeOS; Chrome on Android | Yes (Web MIDI) | Bluetooth LE MIDI and USB vendor mode (experimental) |
| Firefox on a computer | Yes, after allowing a site permission add-on | |
| Safari on macOS, iPhone and iPad; Firefox on Android | No (the browser has no Web MIDI) | Microphone (acoustic piano or voice), on-screen and computer keyboard |

Device notes and troubleshooting: [docs/devices.md](docs/devices.md). If your keyboard does not work, a [device report](https://github.com/Markus-web/nuottitreeni/issues/new?template=device-report.yml) helps.

## Run your own copy

### Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Markus-web/nuottitreeni)

The button copies this repository to your GitHub or GitLab account, creates a Worker and a D1 database (for sync codes) and deploys the site. The free Workers plan is enough: pages and files are served as static assets and only `/api/*` runs the Worker.

After the first deploy, set `OPERATOR_NAME` and `OPERATOR_CONTACT` (shown on the privacy page) in the Worker settings. A copy is hidden from search engines until you set `NT_SITE_URL` and `NT_INDEXABLE=1` as build variables. Everything is explained in [docs/self-hosting.md](docs/self-hosting.md) and [docs/configuration.md](docs/configuration.md).

Sync codes work only on the instance that created them. Moving between instances: export your progress in Settings and import it on the other site.

### Other hosts and your own computer

The site is static files plus an optional sync API. Without Cloudflare everything works except sync codes:

- **Static hosting:** Netlify, Cloudflare Pages, GitHub Pages (at a domain root) or any web server, serving the `dist/` folder after `npm run build`.
- **Your own computer:** `npm run dev` (with sync, local database) or `npm run build && npm run serve` (Node only).
- **Docker:** `docker build -t nuottitreeni . && docker run --rm -p 127.0.0.1:8080:8080 nuottitreeni`.

MIDI keyboards and the microphone need `localhost` or HTTPS. Details: [docs/self-hosting.md](docs/self-hosting.md#other-hosts-without-sync-codes).

### By hand

```bash
git clone https://github.com/Markus-web/nuottitreeni.git
cd nuottitreeni
npm ci
npx wrangler d1 create nuottitreeni   # copy the database_id into wrangler.jsonc
npm run build
npm run deploy                        # applies the D1 migrations, then deploys
```

## Develop

Node 24 and npm (22 and 26 work too). No other tools are needed for the app itself.

```bash
npm ci
npm run dev       # build, local D1, then http://127.0.0.1:8797
npm test          # unit and Worker tests
npm run check     # tests, build, dry-run deploy and the browser suite
```

The browser suite (flows, WCAG 2.2 AAA matrix, SEO crawl, Lighthouse budgets) needs Chromium and its own packages: `npm ci --prefix tests/browser --ignore-scripts`. Details: [docs/testing.md](docs/testing.md). How the code fits together: [docs/architecture.md](docs/architecture.md).

## Contributing

Translations, public-domain pieces, lesson fixes, device reports and code are all welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Every change reaches `main` through a pull request that passed CI, so `main` is always safe to deploy. Questions and ideas go to [Discussions](https://github.com/Markus-web/nuottitreeni/discussions). Security issues: [SECURITY.md](SECURITY.md).

## Licence

The code, texts, lessons and piece transcriptions are under the [MIT licence](https://github.com/Markus-web/nuottitreeni/blob/main/LICENSE). Bundled third-party parts keep their own licences: fonts (SIL OFL 1.1), piano samples (MIT), the notation engine (BSD-3-Clause), icons (MIT) and photos (Unsplash License, not MIT). The full list is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
