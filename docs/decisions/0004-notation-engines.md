# 0004: Own staff renderer; OpenSheetMusicDisplay only for imported files

- Status: accepted
- Date: 2026-11-03

## Context

Lessons need single notes, short rows, key signatures and labels under notes, drawn identically at build time (guide pages) and in the browser (drills), with state colours and marks. Built-in pieces are short melodies. Users also want to open real scores (MusicXML, MXL) exported from MuseScore or scanned with Audiveris. A full engraving engine is about 1.4 MB.

## Decision

A small string-based SVG renderer (`src/core/staff.js`) draws lessons, rhythm examples and built-in pieces, both at build time and in the browser. OpenSheetMusicDisplay (BSD-3-Clause, vendored and pinned by sha256) is loaded only when a user opens their own MusicXML or MXL file. MIDI imports use the own renderer on a grand staff.

## Consequences

- Guide and piece pages are light and fully pre-rendered (Lighthouse performance 100).
- The own renderer covers what the lessons need, not general engraving; anything beyond that belongs to imported scores.
- The notation font is a small subset of Noto Music, renamed as the OFL requires.
