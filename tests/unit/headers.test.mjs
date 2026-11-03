// Security headers (worker/headers.js): the single source for API responses and dist/_headers.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ASSET_CACHE, CSP, PAGE_CACHE, PERMISSIONS_POLICY, SECURITY_HEADERS, headersFile } from "../../worker/headers.js";

test("CSP allows only this origin and never inline or eval code", () => {
	const directives = Object.fromEntries(CSP.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
	assert.deepEqual(directives["default-src"], ["'self'"]);
	assert.deepEqual(directives["script-src"], ["'self'"]);
	assert.deepEqual(directives["style-src"], ["'self'"]);
	assert.deepEqual(directives["connect-src"], ["'self'"]);
	assert.deepEqual(directives["object-src"], ["'none'"]);
	assert.deepEqual(directives["frame-ancestors"], ["'none'"]);
	assert.deepEqual(directives["base-uri"], ["'none'"]);
	assert.ok(!/unsafe-(inline|eval|hashes)|wasm-unsafe|https?:|\*/.test(CSP), CSP);
});

test("Permissions-Policy allows MIDI, USB, the microphone, wake lock and full screen for this origin and nothing else sensitive", () => {
	const features = Object.fromEntries(PERMISSIONS_POLICY.split(",").map((f) => f.trim().split("=")));
	assert.equal(features.midi, "(self)");
	assert.equal(features.usb, "(self)");
	assert.equal(features.microphone, "(self)");
	assert.equal(features["screen-wake-lock"], "(self)");
	assert.equal(features.fullscreen, "(self)");
	for (const off of ["camera", "geolocation", "payment", "serial", "hid"]) assert.equal(features[off], "()", off);
});

test("_headers carries every security header for all paths and the cache rules", () => {
	const file = headersFile();
	const all = `${file.split("\n\n")[0]}\n`;
	assert.match(all, /^\/\*\n/);
	for (const [k, v] of Object.entries(SECURITY_HEADERS)) assert.ok(all.includes(`  ${k}: ${v}\n`), k);
	// Pages: no-transform (no zone script injection); assets and sw.js detach it first.
	assert.ok(all.includes(`  Cache-Control: ${PAGE_CACHE}\n`));
	assert.match(PAGE_CACHE, /no-transform/);
	assert.ok(file.includes(`/assets/*\n  ! Cache-Control\n  Cache-Control: ${ASSET_CACHE}\n`));
	assert.doesNotMatch(ASSET_CACHE, /no-transform/);
	assert.ok(file.includes("/sw.js\n  ! Cache-Control\n  Cache-Control: no-cache\n"));
	assert.equal(SECURITY_HEADERS["Referrer-Policy"], "no-referrer");
	assert.match(SECURITY_HEADERS["Strict-Transport-Security"], /max-age=31536000/);
});
