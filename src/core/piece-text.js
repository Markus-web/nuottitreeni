// Text that describes a built-in piece: the text alternative (bar by bar, both hands), the
// figure caption and the key name. Pure, shared by the build (src/templates/pages.js) and the
// piece page, which rebuilds them when a piece is transposed.
import { bars, parseMelody } from "./notation.js";
import { noteName } from "./notes.js";

/** Name of the piece's key, e.g. "G-duuri" or "e-molli", from the locale (piece.keyMajor / keyMinor). */
export function keyName(piece, dict, fifths = piece.fifths) {
	return (piece.minor ? dict.piece.keyMinor : dict.piece.keyMajor)[fifths] ?? "";
}

/** One line per bar: "Tahti 1: C4 neljäsosa, ...; vasen käsi: C3 kokonuotti". */
export function pieceTextLines(piece, t, noteNames) {
	const describe = (bar) =>
		bar
			.map((it) => (it.type === "rest" ? t("piece.values.rest") : `${it.notes.map((n) => `${noteName(n.step, n.alter, noteNames)}${n.octave}`).join("+")} ${t(`piece.values.${it.value}`)}`))
			.join(", ");
	const left = piece.left ? bars(parseMelody(piece.left)) : [];
	return bars(parseMelody(piece.right)).map((bar, i) => `${t("piece.bar", { n: i + 1 })}: ${describe(bar)}${left[i] ? `; ${t("piece.leftHand")}: ${describe(left[i])}` : ""}`);
}

/** The figure caption: title, composer, key, time signature and number of bars. */
export function pieceCaption(piece, title, t, dict) {
	return t("piece.figure", { title, composer: piece.composer, key: keyName(piece, dict), time: `${piece.time[0]}/${piece.time[1]}`, bars: bars(parseMelody(piece.right)).length });
}
