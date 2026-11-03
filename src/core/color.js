// Contrast maths (WCAG relative luminance) for colours drawn at run time, such as text on the
// falling-note bars. The CSS tokens are checked by tests/unit/contrast.test.mjs.

/** Relative luminance of a #rrggbb colour. */
export function luminance(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `background` (#rrggbb). */
export function inkOn(background) {
	return contrastRatio("#000000", background) >= contrastRatio("#ffffff", background) ? "#000000" : "#ffffff";
}
