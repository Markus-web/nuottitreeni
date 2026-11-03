// Fixed-window rate limits in D1. The key is a salted, daily SHA-256 of the client IP and
// the action, so stored rows cannot be linked back to an address or across days.
// The salt is created by the first migration (meta.rate_salt); if a database somehow lacks it,
// the Worker creates one on first use, so deployments never need a secret.

let cachedSalt = null;

async function sha256Hex(text) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getSalt(db) {
	if (cachedSalt) return cachedSalt;
	let row = await db.prepare("SELECT value FROM meta WHERE key = 'rate_salt'").first();
	if (!row) {
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		const value = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
		await db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('rate_salt', ?)").bind(value).run();
		row = await db.prepare("SELECT value FROM meta WHERE key = 'rate_salt'").first();
	}
	cachedSalt = row?.value ?? null;
	return cachedSalt;
}

/** Test hook: forget the cached salt (each test database has its own). */
export function resetSaltCache() {
	cachedSalt = null;
}

export async function rateKey(db, ip, action) {
	const salt = await getSalt(db);
	if (!salt) return null;
	const day = new Date().toISOString().slice(0, 10);
	return `${action}:${(await sha256Hex(`${salt}:${ip}:${day}`)).slice(0, 32)}`;
}

/** Increment and decide in one statement (atomic upsert). */
export async function checkRateLimit(db, key, limit, windowSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
	const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
	const row = await db
		.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count")
		.bind(key, windowStart)
		.first();
	const count = row?.count ?? limit + 1;
	return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: windowStart + windowSeconds - nowSeconds };
}
