// scripts/serve.mjs, the dependency-free server for hosting without Cloudflare: security and
// cache headers, folder index pages, the trailing-slash redirect, the 404 page, path traversal
// protection and the sync-off API answers.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createSiteServer, fileFor, headersFor } from "../../scripts/serve.mjs";

let dir;
let server;
let base;

before(async () => {
	dir = mkdtempSync(join(tmpdir(), "nt-serve-"));
	mkdirSync(join(dir, "ohje"));
	mkdirSync(join(dir, "assets/js"), { recursive: true });
	writeFileSync(join(dir, "index.html"), "<h1>home</h1>");
	writeFileSync(join(dir, "ohje/index.html"), "<h1>help</h1>");
	writeFileSync(join(dir, "404.html"), "<h1>not found</h1>");
	writeFileSync(join(dir, "assets/js/app-abc.js"), "export {};");
	writeFileSync(join(dir, "sw.js"), "/* sw */");
	server = createSiteServer({ dir, operatorName: "Test", operatorContact: "ops@example.org" });
	await new Promise((r) => server.listen(0, "127.0.0.1", r));
	base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
	server.close();
	rmSync(dir, { recursive: true, force: true });
});

test("pages get the security headers; plain http drops HSTS and upgrade-insecure-requests", async () => {
	const res = await fetch(`${base}/`);
	assert.equal(res.status, 200);
	assert.match(await res.text(), /home/);
	assert.match(res.headers.get("content-security-policy"), /default-src 'self'/);
	assert.doesNotMatch(res.headers.get("content-security-policy"), /upgrade-insecure-requests/);
	assert.equal(res.headers.get("strict-transport-security"), null);
	assert.equal(res.headers.get("x-frame-options"), "DENY");
	assert.match(res.headers.get("permissions-policy"), /midi=\(self\)/);
	assert.match(headersFor("/", true)["Content-Security-Policy"], /upgrade-insecure-requests/);
});

test("folders serve index.html, /ohje redirects to /ohje/, assets are immutable, sw.js is not cached", async () => {
	assert.match(await (await fetch(`${base}/ohje/`)).text(), /help/);
	const redirect = await fetch(`${base}/ohje?x=1`, { redirect: "manual" });
	assert.equal(redirect.status, 301);
	assert.equal(redirect.headers.get("location"), "/ohje/?x=1");
	const asset = await fetch(`${base}/assets/js/app-abc.js`);
	assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
	assert.match(asset.headers.get("content-type"), /text\/javascript/);
	assert.equal((await fetch(`${base}/sw.js`)).headers.get("cache-control"), "no-cache");
});

test("unknown paths get the 404 page; traversal outside the folder is refused", async () => {
	const missing = await fetch(`${base}/no-such-page/`);
	assert.equal(missing.status, 404);
	assert.match(await missing.text(), /not found/);
	assert.equal(fileFor(dir, "/../../etc/passwd"), null);
	assert.equal(fileFor(dir, "/%2e%2e/%2e%2e/etc/passwd"), null);
	assert.equal(fileFor(dir, "/%E0%A4%A"), null);
	assert.equal((await fetch(`${base}/..%2f..%2fetc%2fpasswd`)).status, 404);
});

test("the API says sync is off and other API routes answer SYNC_DISABLED", async () => {
	const conf = await (await fetch(`${base}/api/config`)).json();
	assert.deepEqual(conf, { operatorName: "Test", operatorContact: "ops@example.org", syncEnabled: false });
	const sync = await fetch(`${base}/api/sync`, { method: "GET" });
	assert.equal(sync.status, 404);
	assert.equal((await sync.json()).code, "SYNC_DISABLED");
	assert.equal((await fetch(`${base}/`, { method: "POST" })).status, 405);
});
