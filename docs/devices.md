# Keyboards and other input devices

Nuottitreeni reads notes from six kinds of input. They all feed the same event stream (`src/core/input/hub.js`), so every exercise works with any of them.

| Input | Covers | Browsers | Status |
|---|---|---|---|
| **Web MIDI** | USB class-compliant MIDI keyboards, Bluetooth MIDI keyboards paired in the operating system, MIDI interfaces (DIN cables through a USB adapter), virtual and network MIDI ports | Chrome, Edge, Opera, Brave on desktop and Android; Firefox on desktop (version 108 and later, after a site permission add-on) | Main path |
| **Bluetooth LE MIDI** (Web Bluetooth) | BLE MIDI keyboards connected straight from the browser, without pairing in the operating system | Chromium on desktop and Android | Experimental |
| **USB vendor mode** (WebUSB) | Keyboards that use the maker's own USB class but send standard 4-byte USB-MIDI packets (older Yamaha, some Roland, Korg, Casio and Kawai models) when no driver has claimed the device | Chromium on macOS, Android and ChromeOS; on Windows only with the WinUSB driver | Experimental |
| **Microphone** | An acoustic piano or a voice, one note at a time (no chords). Pitch is found in the browser (YIN on the latest 2048 samples every 40 ms) and never recorded or sent | Every browser with a microphone, including Safari on iPhone and iPad | Experimental; the only way to play a real instrument on iOS |
| **Computer keyboard** | Two rows of letter keys as a piano octave (A = C, W = C sharp, ...), Z and X change octave | All | Built in; active only while the on-screen piano has focus |
| **On-screen piano** | Mouse, touch, pen, and the keyboard (arrows and Enter) | All, including Safari and iOS | Built in |

Safari (macOS, iOS, iPadOS) and Firefox for Android have no Web MIDI. On a Mac, a third-party Safari extension can add it; otherwise use the on-screen piano or the computer keyboard.

## Message handling

- Note on with velocity 0 counts as note off. CC64 (sustain pedal) is read.
- MIDI clock, active sensing and other system messages are ignored. SysEx is never requested.
- Keyboards can be plugged in and out while the page is open.
- The Devices page shows the detected key range once you have played the lowest and highest keys.

## Per-keyboard settings

Saved per device name and maker in the browser (`nt.v1.devices`):

| Setting | Use |
|---|---|
| Channel | Listen to all channels or one (for keyboards that send split or layered parts on several channels) |
| Octave shift, transpose | Small keyboards (25 to 61 keys) and transposing instruments |
| Touch response, quietest press | Light or heavy keyboards; ignore ghost notes from worn keys |
| Hand split point | Which notes count as left hand in pieces |
| Output | Send notes back to the instrument (Listen in pieces plays on the instrument) |
| Local Control off and on | For keyboards with speakers: let only the app make sound, then restore |
| Silence all notes | Sends All Notes Off on every channel if a note hangs |

## Keyboard size

The Devices page has a keyboard size setting per instrument (25, 37, 49, 61, 76 or 88 keys, with the range each size covers). The Yamaha DGX-205 and DGX-203 are recognised as 76 keys (E1 to G7) by name. When the size is known, a piece page names the notes that do not fit on the keyboard and points to the octave shift setting. Makers differ for small keyboards, so the option shows the range it assumes; set the octave shift to match your instrument.

## Stream view (OBS)

The Devices page builds a link to the stream view: a keyboard strip that lights up as you play, on a green, black or transparent background, with or without note names. Open it in its own browser window and add that window to OBS as a window capture (OBS browser sources cannot use MIDI); remove a green background with a Chroma Key filter. The URL options are `?bg=green|black|transparent`, `&names=1` and `&low=C2&high=C7` (`src/pages/stream.js`).

## Troubleshooting

- **Nothing happens.** Is the keyboard on and the cable a data cable? Press **Connect instrument** at the top of the page (or **Connect MIDI device** on the Devices page) and allow MIDI when the browser asks. If you blocked it once, allow MIDI in the site settings (the lock or tune icon in the address bar). The MIDI monitor on the Devices page shows whether anything arrives.
- **Double sound or no sound.** If the keyboard has speakers, turn off "sound for incoming notes" in Settings, or mute the keyboard's own sound with Local Control off. If the keyboard is silent, check its volume, the headphone socket and Local Control.
- **Delay.** Use a USB cable rather than Bluetooth, and wired headphones or speakers: Bluetooth audio often adds 150 ms or more. The delay check on the Devices page measures how quickly messages reach the browser.
- **"Access denied" or "already in use" with the USB connection.** The operating system's MIDI driver already holds the keyboard (always on Linux, and on Windows with the maker's driver). That is good news: use **Connect MIDI device** (Web MIDI) instead. The experimental USB connection is only for systems where no driver takes the keyboard.
- **Firefox.** It asks you to add a site permission add-on the first time. That is how Firefox grants MIDI access.
- **Older Yamaha keyboards such as the DGX-205.** They use Yamaha's own USB class. On Linux they appear as normal MIDI devices. On Windows install Yamaha's USB-MIDI driver. On macOS and Android try the experimental USB connection on the Devices page in Chrome or Edge. Their USB port carries MIDI only, no audio.

## Microphone

Turn it on with **Use the microphone** on the Devices page. In browsers without Web MIDI (Safari, for example) the **Connect instrument** button at the top of every page starts the microphone instead. The browser asks for permission once, and the choice is remembered from page to page. Echo cancellation, noise suppression and automatic gain are turned off because they bend the pitch. Notes heard through the microphone are never played back by the app's piano sound (the microphone would hear them again).

Tips: one note at a time, a quiet room, the device near the instrument. A note must hold for about 80 ms before it counts; striking the same key again is recognised when the sound gets clearly louder. Chords and very low notes (below about B1) are not recognised. The detector is in `src/core/pitch.js` with tests in `tests/unit/pitch.test.mjs`.

## Sound on the instrument (MIDI output)

When an output is chosen on the Devices page ("Output, sound to the instrument"), the app's own playback goes there too: Listen on a piece, the other hand in play-along, and the note in the ear drill. Your own playing is never sent back. If you hear everything twice, turn off the app's piano sound in Settings or use only one of them.

## Control keys

Each instrument can have two control keys (Devices page, Device settings, "Choose control keys"): press the key that should start and stop practice, then the one that should start over. The two lowest keys are a good choice. While they are set, those keys do not play notes in the exercises. They work on piece pages, in rhythm tapping and in speed reading. "Remove the control keys" gives the keys back.

## Key lights (experimental)

Keyboards with lighted keys can show the next notes of a piece. Turn on "Light the next keys" under the MIDI output and choose the MIDI channel your keyboard uses for its lights (makers differ; the test button lights C4 for a second). The app sends note-on with velocity 1 for the next notes and note-off when they pass, and all lights go off when you stop. Only pieces use it: in the reading drills a lit key would give the answer away. This has not been tested with a real lighted keyboard yet, so a device report helps.

## Screen stays on

While an exercise runs (a drill round, a piece, Listen, rhythm tapping, speed reading) the app asks the browser to keep the screen on (Screen Wake Lock), so a tablet on the music stand does not dim. The lock ends when you stop or the exercise ends; Settings has a switch to turn this off.

## Device reports

The Devices page builds a report with the device names, makers and the kinds of messages seen (nothing personal). Paste it into a [device report](https://github.com/Markus-web/nuottitreeni/issues/new?template=device-report.yml) so others know what works. Reports for the experimental Bluetooth and USB paths are especially useful, because they cannot be tested without the hardware.

## For developers

- Parsers are pure functions in `src/core/input/parse.js` with tests in `tests/unit/input-parse.test.mjs` (Web MIDI bytes, BLE-MIDI packets with timestamps and running status, USB-MIDI code index numbers).
- The browser suite drives fake Web MIDI, Web Bluetooth and WebUSB devices (`tests/browser/lib/fakes.js`).
- USB vendor ids tried by the WebUSB adapter are listed in `USB_VENDORS` in `src/core/input/adapters.js`. Add a maker there only with a device report that shows standard USB-MIDI packets.
