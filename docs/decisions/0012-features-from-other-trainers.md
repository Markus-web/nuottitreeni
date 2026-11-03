# 0012: Features from other piano trainers, ideas only

- Status: accepted
- Date: 2026-11-03

## Context

Version 1.3.0 adds features that other piano trainers have shown to be useful:
- sightread (GPL-3.0): phrase training, speed training, play-along with the other hand, timing feedback, keeping the screen on, choosing bars, transposing
- Synthesia (commercial): chord names in free play, labels on falling notes, scores and history, key lights
- Midiano (whose ideas were already used in 1.1.0): colours by finger or hand, bar numbers, full screen, controlling practice from the piano keys, names on black keys

Nuottitreeni is MIT-licensed. GPL-3.0 code cannot be copied into it, and a commercial app's code, assets and texts cannot be copied at all.

## Decision

- Only ideas are taken. Every feature is written from scratch in this code base's own style, with its own tests. No code, assets, texts or file formats are copied, and no third-party code is added.
- Ideas that do not fit the app's rules are left out:
  - particle effects: decorative motion, against the AAA motion rules
  - opening songs from a URL: a request to another origin, against the privacy design and the CSP
  - opening whole folders of files: Chromium only
- Timed modes stay optional, with an untimed alternative (speed reading has the untimed drills, tempo mode has wait mode).
- Data that only matters on one device stays in that browser and outside the synced progress format: the piece history and the speed-reading best. Phrase training uses new lesson ids in the existing format.

## Consequences

- The feature set grows without licence questions; THIRD_PARTY_NOTICES.md is unchanged apart from new Phosphor icons.
- Key lights and control keys are experimental until someone reports results with real hardware.
