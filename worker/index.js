// Nuottitreeni Worker: only /api/* reaches this code (wrangler.jsonc run_worker_first);
// every page and asset is served by the static asset layer without invoking the Worker.
//
// API contract: docs/api.md (stable). Errors are JSON { error, code, message }.
// Privacy: the sync store holds practice statistics only, keyed by a SHA-256 of the code;
// client IPs are only used as a salted daily hash for rate limits and kept 2 days.
import pkg from "../package.json" with { type: "json" };
import { CATALOG_IDS } from "../src/content/catalog.js";
import { byteLength, LIMITS, validateProgress } from "../src/core/progress.js";
import { generateCode, hashCode, normalizeCode } from "../src/core/sync-code.js";
import { SECURITY_HEADERS } from "./headers.js";
import { checkRateLimit, rateKey } from "./rate-limit.js";

const RETENTION_DAYS = 365;
const RATE = {
	create: { limit: 10, window: 3600 },
	read: { limit: 120, window: 600 },
	write: { limit: 60, window: 600 },
	delete: { limit: 10, window: 3600 },
};

function json(status, body, extra = {}) {
	return new Response(body === null ? null : JSON.stringify(body), {
		status,
		headers: { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
	});
}

function error(status, code, message, extra) {
	return json(status, { error: true, code, message }, extra);
}

function syncEnabled(env) {
	return String(env.SYNC_ENABLED ?? "true").toLowerCase() !== "false";
}

/** Same-origin only: a browser sends Origin on cross-site requests; reject foreign ones. */
function originAllowed(request) {
	const origin = request.headers.get("Origin");
	if (!origin) return true;
	return origin === new URL(request.url).origin;
}

async function readJson(request) {
	const type = request.headers.get("Content-Type") || "";
	if (!type.toLowerCase().startsWith("application/json")) return { error: error(415, "JSON_REQUIRED", "Send the body as application/json.") };
	const text = await request.text();
	if (byteLength(text) > LIMITS.bytes + 1024) return { error: error(413, "TOO_LARGE", "The data is larger than 64 KiB.") };
	try {
		return { body: JSON.parse(text) };
	} catch {
		return { error: error(400, "INVALID_JSON", "The body is not valid JSON.") };
	}
}

function checkData(data) {
	const result = validateProgress(data, CATALOG_IDS);
	if (!result.ok) {
		const tooBig = result.errors.some((e) => e.startsWith("size"));
		return tooBig
			? error(413, "TOO_LARGE", "The data is larger than 64 KiB.")
			: error(400, "INVALID_DATA", `The progress data is not valid: ${result.errors.slice(0, 3).join("; ")}`);
	}
	return null;
}

async function limited(env, request, action) {
	const ip = request.headers.get("CF-Connecting-IP") || "local";
	const key = await rateKey(env.DB, ip, action);
	if (!key) return error(503, "SYNC_UNAVAILABLE", "Sync is not ready on this site yet.");
	const r = await checkRateLimit(env.DB, key, RATE[action].limit, RATE[action].window);
	if (!r.allowed) return error(429, "RATE_LIMITED", "Too many requests. Try again later.", { "Retry-After": String(r.retryAfter) });
	return null;
}

async function handleSync(request, env, codeParam) {
	if (!syncEnabled(env)) return error(404, "SYNC_DISABLED", "Sync is turned off on this site.");
	if (!originAllowed(request)) return error(403, "ORIGIN", "Requests must come from this site.");
	const now = Date.now();
	const method = request.method;

	if (codeParam === null) {
		if (method !== "POST") return error(405, "METHOD", "Use POST to create a sync code.", { Allow: "POST" });
		const rl = await limited(env, request, "create");
		if (rl) return rl;
		const { body, error: bad } = await readJson(request);
		if (bad) return bad;
		const invalid = checkData(body?.data);
		if (invalid) return invalid;
		// 80-bit codes make collisions practically impossible; retry once just in case.
		for (let attempt = 0; attempt < 2; attempt++) {
			const code = generateCode();
			const hash = await hashCode(normalizeCode(code));
			const res = await env.DB.prepare(
				"INSERT INTO sync_records (code_hash, data, rev, created_at, updated_at, accessed_at) VALUES (?, ?, 1, ?, ?, ?) ON CONFLICT(code_hash) DO NOTHING",
			)
				.bind(hash, JSON.stringify(body.data), now, now, now)
				.run();
			if (res.meta?.changes === 1) return json(201, { code, rev: 1 });
		}
		return error(500, "CODE_COLLISION", "Could not create a code. Try again.");
	}

	const normalized = normalizeCode(codeParam);
	if (!normalized) return error(400, "BAD_CODE", "The sync code is not in the right format.");
	const hash = await hashCode(normalized);

	if (method === "GET") {
		const rl = await limited(env, request, "read");
		if (rl) return rl;
		const row = await env.DB.prepare("SELECT data, rev, updated_at FROM sync_records WHERE code_hash = ?").bind(hash).first();
		if (!row) return error(404, "NOT_FOUND", "No data for this code on this site.");
		await env.DB.prepare("UPDATE sync_records SET accessed_at = ? WHERE code_hash = ?").bind(now, hash).run();
		return json(200, { rev: row.rev, data: JSON.parse(row.data), updatedAt: row.updated_at });
	}

	if (method === "PUT") {
		const rl = await limited(env, request, "write");
		if (rl) return rl;
		const { body, error: bad } = await readJson(request);
		if (bad) return bad;
		if (!Number.isInteger(body?.baseRev) || body.baseRev < 1) return error(400, "INVALID_DATA", "baseRev must be a positive integer.");
		const invalid = checkData(body.data);
		if (invalid) return invalid;
		const updated = await env.DB.prepare(
			"UPDATE sync_records SET data = ?, rev = rev + 1, updated_at = ?, accessed_at = ? WHERE code_hash = ? AND rev = ? RETURNING rev",
		)
			.bind(JSON.stringify(body.data), now, now, hash, body.baseRev)
			.first();
		if (updated) return json(200, { rev: updated.rev });
		const current = await env.DB.prepare("SELECT data, rev FROM sync_records WHERE code_hash = ?").bind(hash).first();
		if (!current) return error(404, "NOT_FOUND", "No data for this code on this site.");
		return json(409, { error: true, code: "REV_CONFLICT", message: "The data changed on another device. Merge and try again.", rev: current.rev, data: JSON.parse(current.data) });
	}

	if (method === "DELETE") {
		const rl = await limited(env, request, "delete");
		if (rl) return rl;
		const res = await env.DB.prepare("DELETE FROM sync_records WHERE code_hash = ?").bind(hash).run();
		if (!res.meta?.changes) return error(404, "NOT_FOUND", "No data for this code on this site.");
		return json(204, null);
	}

	return error(405, "METHOD", "Use GET, PUT or DELETE.", { Allow: "GET, PUT, DELETE" });
}

export async function handleRequest(request, env) {
	const url = new URL(request.url);
	const path = url.pathname.replace(/\/+$/, "");
	try {
		if (path === "/api/health" && request.method === "GET") return json(200, { ok: true, app: "nuottitreeni", version: pkg.version });
		if (path === "/api/config" && request.method === "GET")
			return json(
				200,
				{ operatorName: env.OPERATOR_NAME || "", operatorContact: env.OPERATOR_CONTACT || "", syncEnabled: syncEnabled(env) },
				{ "Cache-Control": "public, max-age=300" },
			);
		if (path === "/api/sync") return await handleSync(request, env, null);
		const m = /^\/api\/sync\/([^/]+)$/.exec(path);
		if (m) return await handleSync(request, env, decodeURIComponent(m[1]));
		return error(404, "NOT_FOUND", "Unknown API route.");
	} catch (err) {
		// Fail closed with a generic message; details stay out of responses.
		console.error("api error", err?.message);
		return error(500, "INTERNAL", "Something went wrong. Try again later.");
	}
}

/** Daily cleanup: idle sync records after the retention period, and old rate-limit rows. */
export async function cleanup(env, now = Date.now()) {
	const cutoff = now - RETENTION_DAYS * 86_400_000;
	const rateCutoff = Math.floor(now / 1000) - 2 * 86_400;
	await env.DB.batch([
		env.DB.prepare("DELETE FROM sync_records WHERE accessed_at < ?").bind(cutoff),
		env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(rateCutoff),
	]);
}

export default {
	fetch: (request, env) => handleRequest(request, env),
	scheduled: (_event, env, ctx) => ctx.waitUntil(cleanup(env)),
};
