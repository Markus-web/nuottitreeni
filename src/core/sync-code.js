// Sync codes: 10 random bytes (80 bits) as 16 Crockford base32 characters, shown as
// XXXX-XXXX-XXXX-XXXX. The server stores only a SHA-256 of the normalized code, so a database
// leak does not reveal working codes. Works in browsers, Workers and Node 22 (Web Crypto).

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function encodeBase32(bytes) {
	let bits = 0;
	let value = 0;
	let out = "";
	for (const b of bytes) {
		value = (value << 8) | b;
		bits += 8;
		while (bits >= 5) {
			out += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

export function formatCode(raw16) {
	return raw16.match(/.{4}/g).join("-");
}

export function generateCode() {
	const bytes = new Uint8Array(10);
	crypto.getRandomValues(bytes);
	return formatCode(encodeBase32(bytes));
}

/**
 * Accepts what people type: any case, spaces or hyphens, and the Crockford look-alikes
 * I/L (read as 1) and O (read as 0). Returns the 16-character form or null.
 */
export function normalizeCode(input) {
	if (typeof input !== "string") return null;
	const s = input
		.toUpperCase()
		.replace(/[\s-]/g, "")
		.replace(/[IL]/g, "1")
		.replace(/O/g, "0");
	if (s.length !== 16) return null;
	for (const c of s) if (!ALPHABET.includes(c)) return null;
	return s;
}

export async function hashCode(normalized) {
	const data = new TextEncoder().encode(`nuottitreeni:v1:${normalized}`);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Random device id for progress sections (lowercase base32, 26 chars). */
export function generateDeviceId() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return encodeBase32(bytes).toLowerCase();
}
