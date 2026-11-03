# 0009: Piece practice aids: names, fingering, falling notes

- Status: accepted
- Date: 2026-11-03

## Context

Play-along apps such as Midiano help beginners with falling notes, note and finger labels and loops. Nuottitreeni teaches reading sheet music, so these aids must support the score, not replace it, and they must not add motion or noise for people who do not want them.

## Decision

- Note names and suggested fingering are optional labels on the built-in scores. Fingering is computed (`src/core/fingering.js`: five-finger positions chosen over the whole melody with a small dynamic program) and called a suggestion.
- Falling notes are an optional canvas above the on-screen keyboard, off by default, `aria-hidden`, moving only while a tempo run or Listen plays and stopped by the Stop button (WCAG 2.2.2, 2.3.3).
- Loops repeat in tempo mode with a new count-in; the score can be printed (print styles keep only the score and its text version).

## Consequences

- The score stays the primary view and the text version stays the accessible alternative.
- Settings remember each aid, so a learner can drop them one by one as reading improves.
