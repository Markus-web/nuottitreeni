// API contract tests: the real worker/index.js against an in-process D1 (node:sqlite) with
// the real migration applied. Covers every route, error code, limit and header.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import pkg from "../../package.json" with { type: "json" };
import { emptyProgress, recordRound } from "../../src/core/progress.js";
import { cleanup, handleRequest } from "../../worker/index.js";
import { resetSaltCache } from "../../worker/rate-limit.js";
import { createD1 } from "../helpers/d1-sqlite.mjs";

const MIGRATION = fileURLToPath(new URL("../../migrations/0001_init.sql", import.meta.url));
const ORIGIN = "https://piano.example";
const DEV = "aaaaaaaaaaaaaaaaaaaaaaaaaa";
let env;

beforeEach(() => {
	resetSaltCache();
	env = { DB: createD1([MIGRATION]), OPERATOR_NAME: "Test Operator", OPERATOR_CONTACT: "ops@example.org", SYNC_ENABLED: "true" };
});

function req(method, path, { body, headers = {}, ip = "203.0.113.5" } = {}) {
	const h = { "CF-Connecting-IP": ip, ...headers };
	if (body !== undefined) h["Content-Type"] ??= "application/json";
	return handleRequest(new Request(`${ORIGIN}${path}`, { method, headers: h, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }), env);
}

const progress = (accuracy = 80) => recordRound(emptyProgress(), DEV, { kind: "lesson", id: "keys", mode: "single", accuracy, results: [{ key: "C", ok: true, ms: 900 }] }, 1_762_000_000_000);

test("health and config", async () => {
	const h = await req("GET", "/api/health");
	assert.equal(h.status, 200);
	assert.deepEqual(await h.json(), { ok: true, app: "nuottitreeni", version: pkg.version });
	const c = await req("GET", "/api/config");
	assert.deepEqual(await c.json(), { operatorName: "Test Operator", operatorContact: "ops@example.org", syncEnabled: true });
});

test("security headers on every API response", async () => {
	for (const r of [await req("GET", "/api/health"), await req("GET", "/api/nope"), await req("POST", "/api/sync", { body: "x", headers: { "Content-Type": "text/plain" } })]) {
		assert.match(r.headers.get("Content-Security-Policy"), /default-src 'self'/);
		assert.match(r.headers.get("Permissions-Policy"), /midi=\(self\)/);
		assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
		assert.equal(r.headers.get("Cache-Control") === "no-store" || r.headers.get("Cache-Control") === "public, max-age=300", true);
	}
});

test("create, read, update, conflict, delete", async () => {
	const created = await req("POST", "/api/sync", { body: { data: progress() } });
	assert.equal(created.status, 201);
	const { code, rev } = await created.json();
	assert.match(code, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
	assert.equal(rev, 1);
	// Stored by hash only: the code itself is nowhere in the table.
	const rows = env.DB.raw.prepare("SELECT * FROM sync_records").all();
	assert.equal(rows.length, 1);
	assert.ok(!JSON.stringify(rows).includes(code.replaceAll("-", "")));

	const lower = code.toLowerCase().replaceAll("-", " ");
	const got = await req("GET", `/api/sync/${encodeURIComponent(lower)}`);
	assert.equal(got.status, 200);
	assert.equal((await got.json()).rev, 1);

	const put = await req("PUT", `/api/sync/${code}`, { body: { baseRev: 1, data: progress(90) } });
	assert.equal(put.status, 200);
	assert.equal((await put.json()).rev, 2);

	const stale = await req("PUT", `/api/sync/${code}`, { body: { baseRev: 1, data: progress(70) } });
	assert.equal(stale.status, 409);
	const conflict = await stale.json();
	assert.equal(conflict.code, "REV_CONFLICT");
	assert.equal(conflict.rev, 2);
	assert.equal(conflict.data.devices[DEV].lessons.keys.single.best, 90);

	assert.equal((await req("DELETE", `/api/sync/${code}`)).status, 204);
	assert.equal((await req("GET", `/api/sync/${code}`)).status, 404);
	assert.equal((await req("DELETE", `/api/sync/${code}`)).status, 404);
});

test("input validation and error codes", async () => {
	assert.equal((await (await req("POST", "/api/sync", { body: "{}", headers: { "Content-Type": "text/plain" } })).json()).code, "JSON_REQUIRED");
	assert.equal((await (await req("POST", "/api/sync", { body: "{not json" })).json()).code, "INVALID_JSON");
	assert.equal((await (await req("POST", "/api/sync", { body: { data: { v: 1, devices: { x: 1 } } } })).json()).code, "INVALID_DATA");
	assert.equal((await (await req("POST", "/api/sync", { body: { data: { v: 1, devices: {}, notes: "free text" } } })).json()).code, "INVALID_DATA");
	const huge = { data: progress(), padding: "x".repeat(70_000) };
	assert.equal((await req("POST", "/api/sync", { body: huge })).status, 413);
	assert.equal((await (await req("GET", "/api/sync/short")).json()).code, "BAD_CODE");
	assert.equal((await req("PATCH", "/api/sync/ABCD-EFGH-JKMN-PQRS")).status, 405);
	assert.equal((await req("GET", "/api/sync")).status, 405);
	const noRev = await req("PUT", "/api/sync/ABCD-EFGH-JKMN-PQRS", { body: { data: progress() } });
	assert.equal((await noRev.json()).code, "INVALID_DATA");
});

test("foreign origins are rejected, same origin and no origin allowed", async () => {
	const foreign = await req("POST", "/api/sync", { body: { data: progress() }, headers: { Origin: "https://evil.example" } });
	assert.equal(foreign.status, 403);
	assert.equal((await foreign.json()).code, "ORIGIN");
	assert.equal((await req("POST", "/api/sync", { body: { data: progress() }, headers: { Origin: ORIGIN } })).status, 201);
	assert.equal((await req("POST", "/api/sync", { body: { data: progress() } })).status, 201);
});

test("rate limits answer 429 with Retry-After, per client", async () => {
	for (let i = 0; i < 10; i++) assert.equal((await req("POST", "/api/sync", { body: { data: progress() } })).status, 201);
	const blocked = await req("POST", "/api/sync", { body: { data: progress() } });
	assert.equal(blocked.status, 429);
	assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
	assert.equal((await req("POST", "/api/sync", { body: { data: progress() }, ip: "198.51.100.7" })).status, 201, "other client unaffected");
	const keys = env.DB.raw.prepare("SELECT key FROM rate_limits").all().map((r) => r.key);
	assert.ok(keys.every((k) => !k.includes("203.0.113.5")), "IP never stored in clear");
});

test("sync can be turned off; salt is created when missing", async () => {
	env.SYNC_ENABLED = "false";
	const off = await req("POST", "/api/sync", { body: { data: progress() } });
	assert.equal(off.status, 404);
	assert.equal((await off.json()).code, "SYNC_DISABLED");
	assert.equal((await (await req("GET", "/api/config")).json()).syncEnabled, false);
	env.SYNC_ENABLED = "true";
	env.DB.raw.exec("DELETE FROM meta");
	resetSaltCache();
	assert.equal((await req("POST", "/api/sync", { body: { data: progress() } })).status, 201);
	assert.equal(env.DB.raw.prepare("SELECT count(*) AS n FROM meta").get().n, 1);
});

test("cleanup removes idle records and old rate rows", async () => {
	const { code } = await (await req("POST", "/api/sync", { body: { data: progress() } })).json();
	const day = 86_400_000;
	await cleanup(env, Date.now() + 366 * day);
	assert.equal(env.DB.raw.prepare("SELECT count(*) AS n FROM sync_records").get().n, 0);
	assert.equal(env.DB.raw.prepare("SELECT count(*) AS n FROM rate_limits").get().n, 0);
	assert.equal((await req("GET", `/api/sync/${code}`)).status, 404);
});

test("unknown routes are JSON 404", async () => {
	const r = await req("GET", "/api/whatever");
	assert.equal(r.status, 404);
	assert.equal((await r.json()).code, "NOT_FOUND");
});
