import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeBase32, generateCode, generateDeviceId, hashCode, normalizeCode } from "../../src/core/sync-code.js";

test("generated codes have the documented shape and survive normalization", () => {
	for (let i = 0; i < 50; i++) {
		const c = generateCode();
		assert.match(c, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
		assert.equal(normalizeCode(c), c.replaceAll("-", ""));
	}
});

test("normalization accepts what people type", () => {
	assert.equal(normalizeCode(" abcd-efgh jkmn-pqrs "), "ABCDEFGHJKMNPQRS");
	assert.equal(normalizeCode("ILO0-1111-2222-3333"), "1100111122223333");
	assert.equal(normalizeCode("ABCD-EFGH-JKMN-PQR"), null, "too short");
	assert.equal(normalizeCode("ABCD-EFGH-JKMN-PQRU"), null, "U is not in the alphabet");
	assert.equal(normalizeCode(42), null);
});

test("hash is stable and does not contain the code", async () => {
	const h = await hashCode("ABCDEFGHJKMNPQRS");
	assert.match(h, /^[0-9a-f]{64}$/);
	assert.equal(h, await hashCode("ABCDEFGHJKMNPQRS"));
	assert.notEqual(h, await hashCode("ABCDEFGHJKMNPQRT"));
});

test("base32 and device ids", () => {
	assert.equal(encodeBase32(new Uint8Array([0, 0, 0, 0, 0])), "00000000");
	assert.match(generateDeviceId(), /^[0-9a-hjkmnp-tv-z]{26}$/);
});
