# Decisions

Short records of choices that shape the code, with the reasons, so they are not undone by accident. Add a new numbered file for a new decision; when one is replaced, mark the old one "Superseded by NNNN" instead of deleting it.

| No. | Decision |
|---|---|
| [0001](0001-browser-only.md) | The app runs in the browser; no local program |
| [0002](0002-sync-codes-per-instance.md) | Optional sync codes in D1, per instance, no accounts |
| [0003](0003-static-assets-first.md) | Pre-rendered pages from the asset layer; the Worker only for `/api/*` |
| [0004](0004-notation-engines.md) | Own staff renderer; OpenSheetMusicDisplay only for imported files |
| [0005](0005-input-adapters.md) | Web MIDI first, Bluetooth and USB vendor mode as experimental adapters |
| [0006](0006-licence-and-assets.md) | MIT for the project; third-party assets vendored with their own licences |
| [0007](0007-seo-defaults-for-copies.md) | Copies are hidden from search engines unless the operator opts in |
