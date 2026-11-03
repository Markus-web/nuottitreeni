// Security headers: the single source for both the Worker responses (/api/*) and the static
// files (the build writes them into dist/_headers). Strict by default: same-origin only, no
// third-party anything. MIDI and USB are allowed for this origin because they are input
// devices; camera, microphone and the rest stay off. Bluetooth is not listed: Chromium has no
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
	"camera=()",
	"microphone=()",
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

/** dist/_headers content for Workers static assets. */
export function headersFile() {
	const lines = ["/*"];
	for (const [k, v] of Object.entries(SECURITY_HEADERS)) lines.push(`  ${k}: ${v}`);
	lines.push("", "/assets/*", "  Cache-Control: public, max-age=31536000, immutable");
	lines.push("", "/sw.js", "  Cache-Control: no-cache");
	lines.push("", "/*.html", "  Cache-Control: public, max-age=0, must-revalidate");
	return `${lines.join("\n")}\n`;
}
