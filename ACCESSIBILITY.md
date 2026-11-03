# Accessibility

The target is **WCAG 2.2 level AAA**: every applicable success criterion at levels A, AA and AAA, in both themes and both languages. Each instance shows an accessibility statement in the app (generated from `src/content/legal.js`) with the operator's contact for feedback.

## How it is tested

Every change runs the browser suite (`tests/browser/run.mjs`, see [docs/testing.md](docs/testing.md)):

- axe-core with the `wcag2a`, `wcag2aa`, `wcag2aaa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice` rules on every page type, in Finnish and English, dark and light, at 320 and 1280 pixels wide.
- Own checks for what axe does not cover: 44 by 44 pixel targets, a visible focus ring with 3:1 contrast on every tab stop, the skip link, one `h1` and no skipped heading levels, no horizontal scrolling at 320 pixels, text spacing overrides without clipping, no running animations, and design rules such as text no smaller than 12 pixels.
- Full practice rounds, rhythm questions and a piece played with the keyboard only, and a drill in forced colours (Windows high contrast).
- Colour tokens checked in `tests/unit/contrast.test.mjs`: text 7:1, borders and states 3:1.
- Lighthouse accessibility score 100 on the main pages.

## What the app does

| Need | How |
|---|---|
| Seeing the notes and keys | Text contrast 7:1, key states marked with ✓ and ✗ as well as colour, high contrast mode supported, notation scales with the text |
| Keyboard use | Every control works with the keyboard. The on-screen piano is one tab stop; arrow keys move between keys, Enter or Space plays. Letter keys play notes only while the piano has focus |
| Screen readers | Real headings and landmarks, status messages announced politely, names for every control, a text version of every built-in piece |
| Time | No time limits in lessons, rhythm questions or the wait mode for pieces. Timed modes are optional and can be slowed down |
| Motion | Nothing moves, blinks or plays by itself. Reduced motion is respected |
| Understanding | Plain language, every music term explained in the lesson and the glossary, examples with note names written out |
| Small screens and zoom | Works at 320 pixels wide and at 400 % zoom; the staff and the keyboard scroll inside their own box |

## Known limitations and exceptions

- **The practice note (1.1.1, test exception).** In a drill, the staff tells assistive technology only which staff the practice note is on (for example "Practice note on the treble staff"), because the exact note would give away the answer. The key-name lesson, the rhythm questions, the glossary and the piece text versions are fully usable with a screen reader.
- **Black keys (2.5.5, essential exception).** Black keys are narrower than 44 pixels because the shape of the keyboard is part of what is taught. They are at least 24 pixels wide, and every key can be chosen with the arrow keys.
- **Two-dimensional content (1.4.10).** On narrow screens the keyboard and the staff scroll sideways inside their own box; the page itself never does.
- **Timed rhythm (2.2.3).** Playing a rhythm and the tempo mode for pieces are timed by nature. They are optional, the tempo can be lowered to 40 beats per minute, and the untimed rhythm questions and wait mode cover the same skills.
- **Music terms (3.1.3, 3.1.5).** Terms like clef and ledger line cannot be avoided. Each is explained where it first appears and in the glossary.
- **Manual testing.** Screen reader testing with NVDA, VoiceOver and Orca has not been done on every device yet. Reports are welcome.

## Feedback

Open an [issue](https://github.com/Markus-web/nuottitreeni/issues/new?template=bug.yml) and mention accessibility, or contact the operator of the instance you use (shown on its accessibility page). For the official instance at piano.markussilvo.fi, the contact is on <https://piano.markussilvo.fi/saavutettavuus/>.
