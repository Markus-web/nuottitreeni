# Third-party notices

Nuottitreeni's own code, texts, lessons and piece transcriptions are under the MIT licence ([LICENSE](https://github.com/Markus-web/nuottitreeni/blob/main/LICENSE)). The parts below come from other projects and keep their own licences. The app's Licences page (`src/content/licenses.js`) shows the same list; keep both in step when something changes.

## Shipped with the app

| Part | Version | Licence | Where | Used for |
|---|---|---|---|---|
| [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | 2.2.1 | BSD-3-Clause | `src/vendor/osmd/` (licence: `src/vendor/osmd/LICENSE`) | Showing imported MusicXML and MXL files |
| [VexFlow](https://github.com/0xfe/vexflow), inside OpenSheetMusicDisplay | 1.2.93 | MIT | bundled in `src/vendor/osmd/opensheetmusicdisplay.min.js` | Engraving the notation |
| [JSZip](https://github.com/Stuk/jszip), inside OpenSheetMusicDisplay | 3.10.1 | MIT or GPL-3.0 (used under MIT) | bundled in `src/vendor/osmd/opensheetmusicdisplay.min.js` | Opening compressed MXL files |
| [Phosphor Icons](https://github.com/phosphor-icons/core) | 2.1.1 | MIT | `src/content/icons.js` (licence: `src/vendor/phosphor/LICENSE`) | Icons in the menu and on buttons |
| [Space Grotesk](https://github.com/floriankarsten/space-grotesk) | 2.0.0 | SIL Open Font License 1.1 | `src/assets/fonts/space-grotesk.woff2` (licence: `src/assets/fonts/OFL-SpaceGrotesk.txt`) | Heading font (subset) |
| [Noto Music](https://github.com/notofonts/music) | 2.004 | SIL Open Font License 1.1 | `src/assets/fonts/nt-music.woff2` (licence: `src/assets/fonts/OFL-NotoMusic.txt`) | Clefs, accidentals and rests (subset, renamed "NT Music" as the OFL asks for modified versions) |
| FluidR3_GM soundfont by Frank Wen | 3.1 | MIT | `src/assets/piano/*.mp3` (licence: `src/assets/piano/COPYING-FluidR3_GM.txt`) | Piano sound, 29 samples rendered from the soundfont |

The vendoring scripts record the exact sources and checksums: `scripts/vendor-osmd.mjs` with `src/vendor/osmd/VERSION.json`, `scripts/vendor-phosphor.mjs` with `src/vendor/phosphor/VERSION.json`, `scripts/build-fonts.mjs` and `scripts/build-piano-samples.mjs`.

## Photos (Unsplash License, not MIT)

The photos in `src/assets/photos/` are from [Unsplash](https://unsplash.com/) and are used under the [Unsplash License](https://unsplash.com/license). It allows using, changing and redistributing them for free, including commercially. It does not allow selling the photos without significant changes, or compiling them into a similar or competing photo service. They are **not** covered by this repository's MIT licence: if you reuse them outside this app, the Unsplash License applies.

Credit is not required by the licence, but the app shows it under every photo.

| File prefix | Photographer | Photo |
|---|---|---|
| `keys` | [Johannes Plenio](https://unsplash.com/@jplenio) | <https://unsplash.com/photos/piano-keys-RWytwNueNng> |
| `music-stand` | [Lorenzo Spoleti](https://unsplash.com/@lorenzospoleti) | <https://unsplash.com/photos/music-note-on-brown-piano-MlhJNEUQpBs> |
| `hands` | [Seth Gerak](https://unsplash.com/@true_films) | <https://unsplash.com/photos/a-man-is-playing-a-keyboard-with-his-hands-PwT9HOd2JsA> |
| `sheet-music` | [Marius Masalar](https://unsplash.com/@marius) | <https://unsplash.com/photos/tilt-selective-photograph-of-music-notes-rPOmLGwai2w> |

The files are cropped and resized copies made by `scripts/build-photos.mjs`; the sources and their checksums are in `src/content/photos.js`.

## Documents

| Part | Licence | Where |
|---|---|---|
| [Contributor Covenant](https://www.contributor-covenant.org/) 2.1 | CC BY 4.0 | `CODE_OF_CONDUCT.md` |

## Development and test tools (not shipped)

The optional Docker image (`Dockerfile`) is based on the official `node:24-alpine` image (Node.js is MIT licensed; the Alpine packages keep their own licences). These are installed by npm for building and testing and are not part of the deployed site: esbuild (MIT), Wrangler (MIT or Apache-2.0), playwright-core (Apache-2.0), axe-core (MPL-2.0), Lighthouse (Apache-2.0) and their dependencies. See `package-lock.json` and `tests/browser/package-lock.json` for the exact versions.
