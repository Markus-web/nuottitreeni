# Audit checklist

For maintainers and AI agents before a release, or whenever you want to know whether the project is in good shape. Run every row, write down what you find, fix it, and run the whole list again until a pass finds nothing. Anything you cannot fix now goes into an issue with the `bug` or `enhancement` label.

## 1. Automated checks

| What | Command | Passes when |
|---|---|---|
| Unit, Worker and content tests | `npm test` | All green. Includes music facts, locale parity, contrast, copy rules, unused translation keys, Markdown links and anchors, script headers |
| Build and size budgets | `npm run build` | No budget error; the report names the largest page script (`maxPageJs`) |
| Everything CI runs | `npm run check:fresh`: `npm audit` and `npm run check` in a fresh copy of the tracked and new files (`scripts/check-fresh.mjs`), so local files cannot hide a problem | Exit 0 |
| Browser flows and the WCAG 2.2 AAA matrix | `node tests/browser/run.mjs --only flows,aaa` | All `ok`. While fixing, `--grep <text>` runs only matching flows and pages |
| SEO, Lighthouse, deploy-button template | `node tests/browser/run.mjs --only seo,lighthouse,template` | All `ok`, Lighthouse 100 in every category |
| Dependencies | `npm audit` and `npm --prefix tests/browser audit` | 0 vulnerabilities; new versions at least 14 days old unless they fix an advisory ([release.md](release.md#dependency-updates)) |
| Shell scripts | `npx shellcheck scripts/*.sh` | No warnings |

## 2. Look at it

| What | How | Look for |
|---|---|---|
| Every page type, both themes, phone and desktop | `node tests/browser/shots.mjs --widths 320,1280` (full pages); `--top` or `--bottom` for the header or footer only | Clutter, unclear order, wrapping, overlap, doubled marks, text that is hard to read, anything that looks broken |
| Note colours | `node tests/browser/shots.mjs --settings '{"noteColors":true,"fallingNotes":true}' /kappaleet/ukko-nooa/` | Bands on every white key, colours on the falling notes, names still visible |
| A first visit | A private window: home, lesson 1, its practice | The "How to start" steps lead to a first exercise without guessing; the "How to practise" box is open the first time and closed the next |
| Real devices | A MIDI keyboard (USB and Bluetooth), a phone, a tablet, the microphone with an acoustic piano | Connect, play, unplug (the status says so), the range warning with the keyboard size set; control keys; play-along and Listen sounding through MIDI out; key lights on a lighted keyboard; the screen staying on during a piece; full screen |
| Music | The bass lines and phrases by ear, a transposed piece on the instrument | They sound right; nothing needs double sharps or awkward ledger lines |

## 3. Read it

- **All UI text, both languages** (`src/content/locales/*.js`): plain words, the same term for the same thing everywhere (soitin/instrument, kosketin/key), button names in the step texts match the real buttons, no promises the app does not keep. Finnish uses H for B.
- **Music facts:** note names, staff positions, key signatures, the worked examples. Each must be covered by a test in `tests/unit/content.test.mjs` or `tests/unit/explain.test.mjs`. If you are not sure, ask before changing it.
- **Legal texts** (`src/content/legal.js`): match what the app stores and sends ([privacy-design.md](privacy-design.md)).

## 4. Review the code

Read every file changed since the last release (`git diff vX.Y.Z -- src worker scripts`):

- Inputs from outside (MIDI bytes, imported files, URL parameters, sync responses, `localStorage`) are validated before use.
- No inline styles or scripts (the CSP blocks them); no requests to other origins; no `innerHTML` with text that did not come from the app's own templates.
- Event listeners are removed when a view is rebuilt (AbortController), timers are cleared on stop.
- Comments say why, and match the code.

## 5. Hosting and privacy

- `npm run prove:live -- --base https://your.domain --browser` on each instance you run: headers, no injected scripts, sync round trip, axe and Lighthouse on the live pages.
- The PWA: the installability flow passes, every file is cached, new pages open offline.

## 6. GitHub

- Open pull requests: each is either merged, has a next step, or is closed with the reason.
- Open issues: still accurate, labelled, and the community ones say how to start.
- Security: Dependabot alerts, code scanning and secret scanning show nothing open.
- Branch protection on `main` matches [decision 0011](decisions/0011-stable-main.md).

## 7. Docs

- `README.md` and `README.fi.md` describe what the app does now.
- `CHANGELOG.md` has every user-visible change under `Unreleased`, with the reason.
- `AGENTS.md` layout, commands and contracts match the code; [testing.md](testing.md) lists every test command.
- Relative links resolve (`npm test` checks them).
