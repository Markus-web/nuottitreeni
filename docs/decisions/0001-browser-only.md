# 0001: The app runs in the browser

- Status: accepted
- Date: 2026-11-03

## Context

The project started as a local prototype: a small daemon on one Linux computer read the keyboard with ALSA tools and served a trainer page. It worked on that one machine only, needed system services and could not be shared. The goal is that anyone can plug a MIDI keyboard into any computer, tablet or phone and practise without installing anything.

## Decision

Everything runs in the browser: MIDI input (Web MIDI, Web Bluetooth, WebUSB), sound (Web Audio), notation (SVG), storage (`localStorage`, IndexedDB) and offline use (service worker). The only server code is the optional sync API.

## Consequences

- Works on any device with a browser; nothing to install or update by hand.
- Safari and iOS have no Web MIDI, so a MIDI keyboard does not work there; the on-screen piano and the computer keyboard do.
- Some older keyboards need the maker's driver on Windows, or the experimental WebUSB path.
