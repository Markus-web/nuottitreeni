// Inline SVG wrapper for the icon data in src/content/icons.js. Kept apart from the data so
// that pages without icons never download it: only modules that import icons.js pull it in.

/** <svg class="icon"> for an icon export: decorative (aria-hidden), sized by CSS, currentColor. */
export function svgIcon(markup, className = "") {
	return `<svg class="icon${className ? ` ${className}` : ""}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${markup}</svg>`;
}
