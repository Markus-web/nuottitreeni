// Content facts are recomputed from the staff model, so a text edit cannot silently teach
// something wrong. Also checks locale parity, ids and piece data.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { KEY_SIGS, PIECES, PITCH_LESSONS, RHYTHM_LESSONS } from "../../src/content/catalog.js";
import { BOTTOM_LINE } from "../../src/core/explain.js";
import { checkBars, parseMelody } from "../../src/core/notation.js";
import { STEPS, hSystemName, letterName, midiOf } from "../../src/core/notes.js";

// Every locale file is checked, so a new translation gets the same tests.
const localeDir = new URL("../../src/content/locales/", import.meta.url);
const LOCALES = {};
for (const f of readdirSync(localeDir).filter((n) => n.endsWith(".js")).sort()) LOCALES[f.slice(0, -3)] = (await import(new URL(f, localeDir).href)).default;
const { fi, en } = LOCALES;
const nameAt = (pos, system) => (system === "h-system" ? hSystemName(STEPS[pos % 7], 0) : letterName(STEPS[pos % 7], 0));
const seq = (start, system) => [0, 2, 4, 6, 8].map((o) => nameAt(start + o, system)).join(" ");
const spaces = (start, system) => [1, 3, 5, 7].map((o) => nameAt(start + o, system)).join(" ");

test("lesson ids are frozen (progress keys)", () => {
	assert.deepEqual(PITCH_LESSONS.map((l) => l.id), ["keys", "treble-c4-g4", "treble-c4-c5", "treble-c4-g5", "bass-c3-c4", "bass-f2-c4", "grand", "ledger", "accidentals", "keysig"]);
	assert.deepEqual(RHYTHM_LESSONS.map((l) => l.id), ["rhythm-values", "rhythm-rests", "rhythm-meter", "rhythm-play"]);
	// Pieces may be added (any order), never renamed or removed.
	const pieceIds = PIECES.map((p) => p.id);
	for (const id of ["ukko-nooa", "tuiki-tuiki", "maijalla-oli-karitsa", "jaakko-kulta", "oodi-ilolle", "menuetti-g"]) assert.ok(pieceIds.includes(id), `piece ${id}`);
});

test("mnemonics in the texts match the staff model", () => {
	for (const [code, loc] of Object.entries(LOCALES)) {
		const sys = loc.meta.noteNames;
		const trebleText = loc.lessons["treble-c4-c5"].learn.join(" ");
		assert.ok(trebleText.includes(seq(BOTTOM_LINE.treble, sys)), `${code} treble lines ${seq(BOTTOM_LINE.treble, sys)}`);
		assert.ok(trebleText.includes(spaces(BOTTOM_LINE.treble, sys)), `${code} treble spaces`);
		const bassText = loc.lessons["bass-c3-c4"].learn.join(" ");
		assert.ok(bassText.includes(seq(BOTTOM_LINE.bass, sys)), `${code} bass lines ${seq(BOTTOM_LINE.bass, sys)}`);
		assert.ok(bassText.includes(spaces(BOTTOM_LINE.bass, sys)), `${code} bass spaces`);
		assert.ok(loc.lessons["treble-c4-g5"].hint.includes(nameAt(BOTTOM_LINE.treble + 8, sys)), `${code} top line`);
		assert.ok(loc.lessons["bass-f2-c4"].hint.includes(nameAt(BOTTOM_LINE.bass, sys)), `${code} bottom bass line`);
	}
});

test("ledger-line statements match the staff model", () => {
	const fiText = fi.lessons.ledger.learn.join(" ");
	assert.ok(fiText.includes(`ensimmäisellä apuviivalla on ${nameAt(BOTTOM_LINE.treble + 10, "h-system")}`));
	assert.ok(fiText.includes(`toisella apuviivalla ${nameAt(BOTTOM_LINE.treble + 12, "h-system")}`));
	assert.ok(fiText.includes(`ensimmäisellä apuviivalla on ${nameAt(BOTTOM_LINE.bass - 2, "h-system")}`));
	assert.ok(fiText.includes(`toisella apuviivalla ${nameAt(BOTTOM_LINE.bass - 4, "h-system")}`));
	const enText = en.lessons.ledger.learn.join(" ");
	assert.ok(enText.includes(`on the first ledger line is ${nameAt(BOTTOM_LINE.treble + 10, "letters")}`));
	assert.ok(enText.includes(`on the second ledger line ${nameAt(BOTTOM_LINE.treble + 12, "letters")}`));
	assert.ok(enText.includes(`on the first ledger line is ${nameAt(BOTTOM_LINE.bass - 2, "letters")}`));
});

test("no wording that teaches the wrong thing", () => {
	// Note positions are "viivalla" (the line runs through the head). Rests may sit on top of a
	// line, so the rhythm texts are not checked for this phrase.
	const positions = JSON.stringify({ lessons: fi.lessons, explain: fi.explain, glossary: fi.glossary, help: fi.help });
	assert.ok(!/viivan päällä|apuviivan päällä/.test(positions), "use 'viivalla', not 'viivan päällä'");
	const all = JSON.stringify(fi);
	assert.ok(!/Duuri tarkoittaa sävellajia/.test(all));
	assert.ok(!/\bgaps?\b/i.test(JSON.stringify(en)), "use 'space', not 'gap'");
});

test("locales have the same keys and parallel lesson texts", () => {
	const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
	const ignore = /^(meta|slugs)\./;
	const ek = keys(en).filter((k) => !ignore.test(k)).sort();
	for (const [code, loc] of Object.entries(LOCALES)) {
		assert.deepEqual(keys(loc).filter((k) => !ignore.test(k)).sort(), ek, `${code} has the same keys as en`);
		for (const k of ["locale", "tag", "name", "ogLocale", "noteNames", "switchLabel"]) assert.ok(loc.meta[k], `${code} meta.${k}`);
		for (const l of PITCH_LESSONS) {
			assert.ok(loc.lessons[l.id], `${code} ${l.id}`);
			assert.equal(loc.lessons[l.id].learn.length, en.lessons[l.id].learn.length, `${code} ${l.id} paragraph count`);
			assert.ok(loc.slugs.lessons[l.id], `${code} ${l.id} slug`);
		}
		for (const r of RHYTHM_LESSONS) assert.ok(loc.rhythm[r.id] && loc.slugs.rhythm[r.id], `${code} ${r.id}`);
		for (const p of PIECES) assert.ok(loc.piecesMeta[p.id] && loc.slugs.pieces[p.id], `${code} ${p.id}`);
		for (const k of Object.keys(en.slugs.pages)) assert.ok(loc.slugs.pages[k], `${code} slugs.pages.${k}`);
		assert.equal(loc.glossary.length, en.glossary.length, `${code} glossary length`);
		assert.equal(loc.help.length, en.help.length, `${code} help length`);
	}
});

test("slugs are lowercase, unique per locale", () => {
	for (const loc of Object.values(LOCALES)) {
		const all = [...Object.values(loc.slugs.pages), ...Object.values(loc.slugs.lessons), ...Object.values(loc.slugs.rhythm), ...Object.values(loc.slugs.pieces)];
		for (const s of all) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
		for (const group of ["lessons", "rhythm", "pieces"]) {
			const vals = Object.values(loc.slugs[group]);
			assert.equal(new Set(vals).size, vals.length, `${group} slugs unique`);
		}
	}
});

test("lesson pools stay on the piano and key signatures match", () => {
	for (const l of PITCH_LESSONS) {
		for (const ks of l.keySigs ?? [null]) {
			for (const n of l.pool(ks)) {
				if (n.octave == null) continue;
				const m = midiOf(n);
				assert.ok(m >= 21 && m <= 108, `${l.id} ${m}`);
			}
		}
	}
	assert.deepEqual(KEY_SIGS.G.alters, { F: 1 });
	assert.deepEqual(KEY_SIGS.D.alters, { F: 1, C: 1 });
	assert.deepEqual(KEY_SIGS.F.alters, { B: -1 });
});

test("built-in pieces have complete bars and sensible ranges", () => {
	for (const p of PIECES) {
		const items = parseMelody(p.right);
		assert.deepEqual(checkBars(items, p.time[0]), [], `${p.id} bar lengths`);
		for (const it of items) if (it.type === "note") for (const n of it.notes) {
			const m = midiOf(n);
			assert.ok(m >= 48 && m <= 84, `${p.id} note ${m} in a comfortable range`);
		}
	}
	const ids = PIECES.map((p) => p.id);
	assert.equal(new Set(ids).size, ids.length);
});

test("rhythm quizzes have consistent answers", () => {
	const values = RHYTHM_LESSONS.find((r) => r.id === "rhythm-values");
	for (const it of values.items) assert.ok(values.answers.includes(it.beats));
	const meter = RHYTHM_LESSONS.find((r) => r.id === "rhythm-meter");
	for (const b of meter.bars) {
		const sum = parseMelody(b.melody).reduce((a, it) => a + (it.beats ?? 0), 0);
		assert.equal(b.time[0] - sum, b.missing, b.melody);
	}
	const tap = RHYTHM_LESSONS.find((r) => r.id === "rhythm-play");
	for (const pat of tap.patterns) assert.deepEqual(checkBars(parseMelody(pat), 4), [], pat);
});
