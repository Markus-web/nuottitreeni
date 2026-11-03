# Adding a built-in piece

Built-in pieces are short melodies written in a compact text notation and drawn by the app's own staff renderer. Users can always open their own MusicXML, MXL or MIDI files; built-in pieces are for everyone, so they must be free to share.

## Licence rules

- The **melody must be in the public domain** (traditional songs, or composers who died more than 70 years ago) and the arrangement must be **your own transcription**. It is then published under the MIT licence with the rest of the repository.
- Do not copy notes from a modern edition, a website or an app; write them yourself from the tune or from a public-domain edition (for example IMSLP scans marked public domain).
- Lyrics are not included.
- If you are not sure, ask in Discussions before you start.

## Steps

1. Add an entry to `PIECES` in `src/content/catalog.js`:

   ```js
   {
   	id: "ukko-nooa",               // permanent: stored in progress data, never rename it
   	composer: "Carl Michael Bellman (trad.)",
   	level: 1,                      // 1 to 3
   	lesson: "treble-c4-g4",        // the lesson that covers every note used
   	fifths: 0,                     // key signature: 1 = G major, -1 = F major
   	time: [4, 4],
   	right: "C4q C4q C4q E4q | D4q D4q D4q F4q | ...",
   },
   ```

   Notation (see the top of `src/core/notation.js`): `C4q` is C in octave 4 (middle C) as a quarter note; values `w`, `hd`, `h`, `qd`, `q`, `e`; `F#5e` and `Bb4h` for sharps and flats; `C4+E4+G4h` for a chord; `rq` for a rest; `|` between bars. Write the notes as they sound: the key signature is applied when drawing, so in G major write `F#4` and it is shown without a sharp.

2. Add the texts in every locale: `piecesMeta.<id>` with `title` and `description`, and `slugs.pieces.<id>`.
3. Run `npm test`. It checks that every bar has the right number of beats and that the notes stay in a comfortable range (C3 to C6).
4. Build and open the piece page; play it through in wait mode with the on-screen piano or a keyboard. Check the text version under the score.

## Pull request checklist

- Source of the melody and why it is public domain.
- The transcription is your own.
- Played through once in the app.
