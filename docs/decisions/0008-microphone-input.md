# 0008: Microphone input, analysed in the browser only

- Status: accepted
- Date: 2026-11-03

## Context

Many learners have an acoustic piano and no MIDI keyboard, and on iPhone and iPad no browser has Web MIDI at all. Note-reading apps such as NoteTeacher let you play or sing into the microphone. Sending audio to a server would break the privacy promise.

## Decision

An experimental microphone input recognises one note at a time in the browser: an `AnalyserNode` provides the latest 2048 samples every 40 ms, YIN finds the pitch (`src/core/pitch.js`, unit-tested with synthetic tones), and a note tracker turns frames into note on and off events. Echo cancellation, noise suppression and automatic gain are off. Samples are never stored or sent. The microphone pauses while the app plays its own sound and the app never plays microphone notes back. `Permissions-Policy` allows `microphone=(self)`; the privacy notice says what happens to the sound.

An AudioWorklet was not used: the analyser is enough at this frame rate, works in Safari, and needs no extra script file.

## Consequences

- Reading drills and single-note passages of pieces work with an acoustic piano or a voice, on every platform including iOS.
- Chords and very low notes are not recognised; accuracy depends on the room. Device reports are welcome (issue tracker).
