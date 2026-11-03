# Privacy

Nuottitreeni is built so that it does not need to know who you are. This page summarises how data is handled. Each instance also shows a full privacy notice in the app (Privacy page, generated from `src/content/legal.js`) with the operator's name and contact.

## Defaults

- Everything stays in your browser: progress, settings, recordings and the files you open.
- No user accounts, cookies, analytics, ads, fonts or scripts from other services. The Content Security Policy blocks requests to any other origin.
- Workers observability (request logging) is off in `wrangler.jsonc`.

## What is stored where

| Data | Where | Why | How long | Who can see it |
|---|---|---|---|---|
| Practice statistics (lessons, right and wrong answers per note, answer times, minutes per day) | Your browser (`localStorage`, key `nt.v1.progress`) | Progress and weak notes | Until you delete it | You |
| Settings and per-keyboard settings | Your browser (`nt.v1.settings`, `nt.v1.devices`) | Remembering your choices | Until you delete it | You |
| Random device id | Your browser (`nt.v1.device`) | Keeping devices apart when syncing | Until you delete it | You, and the server if you sync |
| Your sync code, if you use one | Your browser (`nt.v1.sync`) | Syncing without typing the code again | Until you unlink this browser | You |
| MIDI recordings, imported sheet music | Your browser (IndexedDB `nuottitreeni`) | Practice log, your own pieces | Until you delete them | You |
| Microphone sound, if you turn the microphone on | Only in memory while it is on: the pitch is worked out in the browser | Recognising the note you play | Not stored at all | Nobody; it is never recorded or sent |
| Practice statistics and device ids, if you create a sync code | The instance's D1 database, keyed by a SHA-256 hash of the code | Copying progress between your devices | Deleted 12 months after last use, or when you delete it | Anyone who knows the code; the instance operator |
| Salted, daily-changing hash of your IP address | The instance's D1 database | Rate limits against abuse | At most 2 days | The instance operator |

The sync server never receives names, contact details, recordings or files. The code itself is not stored, only its hash, so the operator cannot list or recover codes.

## Your controls

In Settings you can export everything as a JSON file, import it elsewhere, delete everything stored in this browser, download what the sync server holds, and delete the server copy.

## If you run your own instance

You are the controller for your instance. Before you open it to others:

- Set `OPERATOR_NAME` and `OPERATOR_CONTACT` (or the build variables `NT_OPERATOR_NAME` and `NT_OPERATOR_CONTACT`) so the privacy notice names you and gives a contact.
- Read the generated privacy notice and adjust `src/content/legal.js` if your setup differs (for example if you turn on request logging, or use another host).
- Set `SYNC_ENABLED` to `false` if you do not want to store anything on the server.

Design details and the threat model: [docs/privacy-design.md](docs/privacy-design.md).
