# 0005: Web MIDI first, Bluetooth and USB vendor mode as experimental adapters

- Status: accepted
- Date: 2026-11-03

## Context

Learners own very different keyboards: class-compliant USB MIDI, Bluetooth MIDI, and older models (such as the Yamaha DGX-205) that use the maker's own USB class. Browsers differ too: Chromium and Firefox have Web MIDI, Safari does not.

## Decision

One input hub merges five sources: Web MIDI (main path), Bluetooth LE MIDI through Web Bluetooth and USB vendor mode through WebUSB (both experimental, Chromium only), the computer keyboard (only while the on-screen piano has focus, so typing elsewhere never plays notes) and the on-screen piano. Parsers are pure and tested; the browser suite uses fake devices for all three hardware paths. Per-device settings cover channel, octave, transpose, velocity and split point.

## Consequences

- Most keyboards work with no setup; older vendor-mode keyboards have a path on macOS, Android and ChromeOS.
- The experimental paths cannot be tested without hardware; device reports from users decide whether they become stable.
- SysEx is never requested, so the browser's MIDI permission prompt stays the simple one.
