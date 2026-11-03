# 0003: Pre-rendered pages from the asset layer; the Worker only for the API

- Status: accepted
- Date: 2026-11-03

## Context

The app should be fast on slow phones, readable by search engines, usable without JavaScript for the guides, and cheap enough to run on Cloudflare's free plan, which limits Worker requests per day.

## Decision

`scripts/build.mjs` renders every page in every language to static HTML. Cloudflare's asset layer serves them; `run_worker_first: ["/api/*"]` makes the Worker run only for the API. Security headers come from one module (`worker/headers.js`) for both the Worker and the generated `_headers` file.

## Consequences

- Page views cost no Worker requests; only sync and config calls do.
- Interactive pages are shells filled by JavaScript; they are `noindex`.
- Configuration that affects pages (site URL, languages, operator) is a build variable, not a runtime one. The operator has a runtime fallback through `/api/config`.
