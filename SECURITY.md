# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/Markus-web/nuottitreeni/security/advisories/new)). Do not open a public issue.

Include what you found, how to reproduce it and what an attacker could do with it. You should get a first reply within a week. This is a hobby project run by one person, so there is no bug bounty, but you will be credited in the advisory and the changelog if you want.

## Supported versions

Only the latest release on `main` gets fixes. Self-hosted copies should update from upstream (see [docs/self-hosting.md](docs/self-hosting.md)).

## Scope

In scope:

- The Worker API (`worker/`): sync codes, rate limits, input validation, D1 queries.
- Anything that breaks the browser-side promises: data leaving the browser without the user creating a sync code, code running from another origin, a way around the Content Security Policy.
- Imported files (MusicXML, MXL, MIDI) that run code or break the page for the user who opened them.
- The build and deploy scripts in this repository.

Out of scope:

- Cloudflare's own platform, and instances run by other people (report those to their operators).
- Someone who knows a sync code reading the statistics behind it. That is how codes work; the app tells users to keep them private.
- Denial of service by sheer volume against an instance on the free Cloudflare plan.

## How the app is built to stay safe

- Strict Content Security Policy: scripts, styles, fonts, images and connections from the site's own origin only; no inline code, no `eval`.
- Sync codes are 80 random bits, stored only as SHA-256 hashes; the server accepts only data shaped like practice statistics, at most 64 KiB.
- Requests from other origins are rejected; rate limits use a salted daily hash of the IP address, kept for two days.
- Workers observability (request logs) is off by default.
- Microphone audio is analysed in the browser only and never stored or sent; the Permissions-Policy allows the microphone for the site itself and nothing else.

More: [PRIVACY.md](PRIVACY.md) and [docs/privacy-design.md](docs/privacy-design.md).
