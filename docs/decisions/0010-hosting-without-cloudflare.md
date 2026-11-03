# 0010: Hosting without Cloudflare

- Status: accepted
- Date: 2026-11-03

## Context

The Deploy button covers Cloudflare, but schools, families and tinkerers also want a copy on their own computer, a home server, Docker or another static host. Only the sync codes need the Worker and D1; everything else is static.

## Decision

- The app treats a missing sync API (a 404 or a non-JSON answer from `/api/config`) as "sync not available", so any static host works.
- `scripts/serve.mjs` is a dependency-free Node server for `dist/` with the same security and cache headers as Cloudflare, answering `/api/config` with sync off. The `Dockerfile` builds the site and runs it as the unprivileged `node` user.
- `docs/self-hosting.md` documents Netlify, Cloudflare Pages, GitHub Pages (domain root only) and plain web servers, and explains why MIDI and the microphone need `localhost` or HTTPS.

## Consequences

- Sync codes remain a Cloudflare feature; other setups move progress with export and import.
- `serve.mjs` is tested (`tests/unit/serve.test.mjs`) and shares `worker/headers.js`, so headers cannot drift.
