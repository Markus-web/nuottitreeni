// Security headers: the single source for both the Worker responses (/api/*) and the static
// files (the build writes them into dist/_headers). Strict by default: same-origin only, no
// third-party anything. MIDI, USB and the microphone are allowed for this origin because they
// are input devices (the microphone is analysed in the browser only, never sent); camera and
// the rest stay off. Bluetooth is not listed: Chromium has no
// Permissions-Policy feature for it (it warns on the name), and Web Bluetooth already needs a
// user gesture and a device chooser on the top-level page.

export const CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self'",
	"font-src 'self'",
	"img-src 'self' data: blob:",
	"media-src 'self' blob:",
	"connect-src 'self'",
	"worker-src 'self'",
	"manifest-src 'self'",
	"object-src 'none'",
	"base-uri 'none'",
	"form-action 'none'",
	"frame-ancestors 'none'",
	"upgrade-insecure-requests",
].join("; ");

export const PERMISSIONS_POLICY = [
	"midi=(self)",
	"usb=(self)",
	"microphone=(self)",
	// Keeping the screen on during practice, and the full-screen practice view.
	"screen-wake-lock=(self)",
	"fullscreen=(self)",
	"camera=()",
	"geolocation=()",
	"payment=()",
	"serial=()",
	"hid=()",
].join(", ");

export const SECURITY_HEADERS = {
	"Content-Security-Policy": CSP,
	"Permissions-Policy": PERMISSIONS_POLICY,
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Resource-Policy": "same-origin",
	"X-Frame-Options": "DENY",
};

/**
 * Cache-Control for pages. no-transform stops Cloudflare zone features (Web Analytics, Zaraz,
 * Rocket Loader) from injecting scripts into the HTML, which would break the "no third-party
 * scripts" promise; the price is that the zone does not compress pages (about 20 KB more on a
 * first visit; the service worker caches pages afterwards). Assets keep zone compression.
 */
export const PAGE_CACHE = "public, max-age=0, must-revalidate, no-transform";
export const ASSET_CACHE = "public, max-age=31536000, immutable";

/** dist/_headers content for Workers static assets. */
export function headersFile() {
	const lines = ["/*"];
	for (const [k, v] of Object.entries(SECURITY_HEADERS)) lines.push(`  ${k}: ${v}`);
	lines.push(`  Cache-Control: ${PAGE_CACHE}`);
	// "! Name" removes the header from the /* rule before setting the path's own value.
	lines.push("", "/assets/*", "  ! Cache-Control", `  Cache-Control: ${ASSET_CACHE}`);
	lines.push("", "/sw.js", "  ! Cache-Control", "  Cache-Control: no-cache");
	return `${lines.join("\n")}\n`;
}
