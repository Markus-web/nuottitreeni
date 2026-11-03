# Privacy design

The user-facing summary is [PRIVACY.md](../PRIVACY.md); the legal notice shown in the app is in `src/content/legal.js`. This page is for people who change the code.

## Principles

1. **Local first.** Nothing leaves the browser unless the user creates or enters a sync code.
2. **Minimum on the server.** The sync server stores practice statistics, random device ids and timestamps. No names, contact details, free text, files or recordings, and no fields the validator does not know.
3. **No third parties.** No CDNs, fonts, analytics, embeds or error trackers. The Content Security Policy (`worker/headers.js`) allows only the site's own origin, and the browser suite fails on any CSP violation.
4. **No identifiers that link visits.** No cookies. IP addresses reach the Worker only for rate limits, as a salted hash that changes every day and is kept for two days.
5. **The user is in control.** Export, import, delete locally, download the server copy, delete the server copy, all from Settings.

## Browser storage (stable keys)

| Key or store | Content | Module |
|---|---|---|
| `localStorage` `nt.v1.settings` | Settings (theme, sound, display, recorder, daily goal, auto sync, MIDI output, inputs turned off) | `src/core/store.js` |
| `nt.v1.device` | Random device id (`[a-z0-9]{8,40}`) | `store.js`, `sync-code.js` |
| `nt.v1.devices` | Per-keyboard settings keyed by "name\|manufacturer" | `store.js` |
| `nt.v1.progress` | Progress v1 | `progress.js` |
| `nt.v1.sync` | `{ code, rev, lastSyncAt }` | `sync.js` |
| IndexedDB `nuottitreeni`, store `takes` | MIDI recordings (Standard MIDI File bytes, start time, length, note count) | `recorder.js`, `log.js` |
| IndexedDB `nuottitreeni`, store `pieces` | Imported MusicXML, MXL and MIDI files | `pieces.js`, `piece.js` |
| Cache Storage `nt-shell-*`, `nt-heavy-*` | The app itself, for offline use | `sw.js` |

When storage is blocked (private mode, browser settings), `store.js` keeps data in memory and the page says that nothing is saved.

## Server data

`migrations/0001_init.sql`:

- `sync_records(code_hash, data, rev, created_at, updated_at, accessed_at)`: one row per sync code. `code_hash` is `SHA-256("nuottitreeni:v1:" + code)`; the code itself is never stored or logged.
- `rate_limits(key, window_start, count)`: `key` is the action plus 32 hex characters of `SHA-256(salt:ip:date)`.
- `meta(key, value)`: the random rate-limit salt.

A daily cron deletes sync records idle for 365 days and rate rows older than two days.

## Threat model

| If | Then | Mitigation |
|---|---|---|
| Someone learns a sync code | They can read and change those practice statistics | 80-bit random codes; the UI calls the code a password; the user can delete the record and create a new code |
| Someone guesses codes | Practically impossible at 80 bits | Read limit 120 per 10 minutes per client |
| The D1 database leaks | Hashed codes and practice statistics, no personal data | Hashing, minimal data, validation |
| The operator is curious | Sees statistics per hashed code, not who they belong to | No accounts, no logs (observability off), IP only as a daily salted hash |
| A malicious imported file | Runs in the user's own browser only | Files are parsed, never executed; size limits; strict CSP |
| A cross-site request | Rejected | `Origin` check, JSON content type required, no cookies |

## Rules for changes

- New stored fields: add them to `validateProgress` with strict limits, to the tables above and to the privacy notice in `src/content/legal.js` (both languages). Never store free text on the server.
- New network requests: same origin only, and only when the user asks for them.
- Turning on Workers observability or adding error reporting changes the privacy notice; do not do it in the default configuration.
