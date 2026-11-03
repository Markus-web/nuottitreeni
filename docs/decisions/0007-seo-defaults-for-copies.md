# 0007: Copies are hidden from search engines unless the operator opts in

- Status: accepted
- Date: 2026-11-03

## Context

Anyone can deploy a copy with one button. Many identical copies indexed by search engines would compete with each other and with the official instance, and an operator may not want a test copy to be found at all.

## Decision

By default every page is `noindex` and `robots.txt` disallows crawling. An operator who wants to be found sets `NT_SITE_URL` and `NT_INDEXABLE=1`; the build then adds canonical links, `hreflang`, a sitemap and `llms.txt` with absolute URLs, and lets the guide pages be indexed. Interactive pages stay `noindex` in every case.

## Consequences

- Test and private copies stay out of search results without any setup.
- Operators who want visibility make one deliberate choice, documented in `docs/configuration.md`.
