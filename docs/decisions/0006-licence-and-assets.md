# 0006: MIT for the project; third-party assets vendored with their own licences

- Status: accepted
- Date: 2026-11-03

## Context

The app should be free to use, copy and host. It needs fonts, piano sound, icons, photos and, for imported scores, a notation engine. Loading these from other sites would break the privacy promise and the strict Content Security Policy.

## Decision

The project's own code, texts, lessons and transcriptions are MIT. Third-party parts are vendored into the repository from pinned sources with recorded checksums, each with its licence file: Space Grotesk and Noto Music (SIL OFL 1.1, subset), piano samples rendered from FluidR3_GM (MIT), Phosphor icons (MIT, only the icons used, inline SVG), OpenSheetMusicDisplay (BSD-3-Clause, with VexFlow and JSZip under MIT), photos from Unsplash (Unsplash License). Generation scripts live in `scripts/`; outputs are committed so contributors need no audio, font or image tools.

## Consequences

- Everything is served from the instance's own origin; no third-party requests.
- The photos are not MIT; `THIRD_PARTY_NOTICES.md` and the Licences page say so, and the app credits the photographers under each photo.
- Built-in pieces must be public-domain melodies in our own transcription.
