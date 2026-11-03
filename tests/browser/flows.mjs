// End-to-end flows against the running site. Each flow throws on failure.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PIECES } from "../../src/content/catalog.js";
import { melodySteps, parseMelody, toMusicXml } from "../../src/core/notation.js";
import { midiOf, parseNoteKey } from "../../src/core/notes.js";
import { encodeSmf } from "../../src/core/smf.js";
import { zipStore } from "../../src/core/zip.js";

const tmp = mkdtempSync(join(tmpdir(), "nt-fixtures-"));
const keyToMidi = (key) => {
	const n = parseNoteKey(key);
	return n.octave == null ? midiOf({ ...n, octave: 4 }) : midiOf(n);
};

async function press(page, midi) {
	await page.evaluate((m) => window.__fakeMidi.press(m), midi);
	await page.evaluate((m) => window.__fakeMidi.release(m), midi);
}

async function waitCount(page, i) {
	await page.waitForFunction((n) => (document.querySelector(".drill-head .count")?.textContent || "").includes(`${n}/`), i, { timeout: 5000 });
}

export function flows(open) {
	return {
		"midi: permission already granted connects without a prompt": async () => {
			const page = await open("/", { mode: "granted" });
			await page.waitForFunction(() => document.getElementById("device-status")?.textContent.includes("Fake Piano"), null, { timeout: 5000 });
			assert.equal(await page.locator("#device-connect").isHidden(), true);
		},
		"midi: denied permission explains what to do": async () => {
			const page = await open("/", { mode: "denied" });
			await page.click("#device-connect");
			await page.waitForFunction(() => document.getElementById("device-status")?.dataset.state === "off" && /esti|blocked/i.test(document.getElementById("device-status").textContent));
		},
		"midi: unsupported browser offers the on-screen keyboard": async () => {
			const page = await open("/", { mode: "unsupported" });
			await page.waitForFunction(() => /ei tue|does not support/i.test(document.getElementById("device-status")?.textContent || ""));
			assert.equal(await page.locator("#device-connect").isHidden(), true);
		},
		"drill: a miss is explained, then a full round is saved": async () => {
			const page = await open("/harjoitus/?l=treble-c4-g4&m=single", { mode: "granted" });
			await page.waitForSelector("section.question[data-key]");
			for (let i = 1; i <= 20; i++) {
				await waitCount(page, i);
				const key = await page.getAttribute("section.question", "data-key");
				const midi = keyToMidi(key);
				if (i === 1) {
					await press(page, midi === 60 ? 62 : 60);
					await page.waitForSelector(".feedback .bad");
					const text = await page.textContent(".feedback");
					assert.match(text, /viivalla|välissä|apuviivalla|alapuolella/);
					assert.match(await page.locator(".key.is-target .key-mark").first().evaluate((el) => getComputedStyle(el, "::before").content), /✓/);
				}
				await press(page, midi);
			}
			await page.waitForSelector("#summary-h");
			assert.equal(await page.evaluate(() => document.activeElement?.id), "summary-h");
			const progress = await page.evaluate(() => JSON.parse(localStorage.getItem("nt.v1.progress")));
			const dev = Object.values(progress.devices)[0];
			assert.equal(dev.lessons["treble-c4-g4"].single.rounds, 1);
			assert.equal(dev.lessons["treble-c4-g4"].single.best, 95);
		},
		"drill: a round works with the computer keyboard only": async () => {
			const page = await open("/harjoitus/?l=keys&m=single", { mode: "unsupported" });
			await page.waitForSelector("section.question[data-key]");
			await page.focus(".kbd .key[tabindex='0']");
			for (let i = 1; i <= 20; i++) {
				await waitCount(page, i);
				const key = await page.getAttribute("section.question", "data-key");
				const pc = keyToMidi(key) % 12;
				for (let guard = 0; guard < 40; guard++) {
					const cur = Number(await page.evaluate(() => document.activeElement?.dataset.midi));
					if (cur % 12 === pc) break;
					await page.keyboard.press(cur % 12 < pc ? "ArrowRight" : "ArrowLeft");
				}
				await page.keyboard.press("Enter");
			}
			await page.waitForSelector("#summary-h");
		},
		"drill: row mode and ear mode": async () => {
			const page = await open("/harjoitus/?l=treble-c4-g4&m=row", { mode: "granted" });
			for (let i = 1; i <= 24; i++) {
				await waitCount(page, i);
				const midi = Number(await page.getAttribute(".staff .is-current", "data-midi"));
				await press(page, midi);
			}
			await page.waitForSelector("#summary-h");
			const ear = await open("/harjoitus/?l=treble-c4-g4&m=ear", { mode: "granted" });
			await ear.click("section.question .actions button");
			for (let i = 1; i <= 20; i++) {
				await waitCount(ear, i);
				await press(ear, keyToMidi(await ear.getAttribute("section.question", "data-key")));
			}
			await ear.waitForSelector("#summary-h");
		},
		"free practice: name the notes with the keyboard only, with one hint": async () => {
			const page = await open("/vapaa-harjoitus/", { mode: "unsupported" });
			await page.selectOption("#free-clef", "bass");
			await page.selectOption("#free-low", "C3");
			await page.selectOption("#free-high", "C4");
			await page.selectOption("#free-mode", "name");
			await page.click("text=Aloita harjoitus");
			await page.waitForSelector("section.question[data-key]");
			await page.click("text=Vihje");
			await page.waitForFunction(() => /Vihje:/.test(document.querySelector(".feedback")?.textContent || ""));
			await page.focus(".answers .answer");
			for (let i = 1; i <= 20; i++) {
				await waitCount(page, i);
				const key = await page.getAttribute("section.question", "data-key");
				// Finnish names: H is B natural.
				await page.keyboard.press(key[0] === "B" ? "h" : key[0].toLowerCase());
			}
			await page.waitForSelector("#summary-h");
			assert.match(await page.textContent("dl.facts"), /95/);
			assert.match(page.url(), /c=bass&lo=C3&hi=C4/);
		},
		"piece: note names, fingering, falling notes and the print view": async () => {
			const page = await open(`/kappaleet/${"ukko-nooa"}/`, { mode: "granted" });
			await page.waitForSelector("#score svg");
			await page.check("text=Näytä nuottien nimet nuoteissa");
			await page.check("text=Näytä ehdotettu sormitus");
			await page.check("text=Näytä putoavat nuotit");
			assert.equal(await page.locator("#score .st-label").count(), 38, "a name under every note of Ukko Nooa");
			assert.equal(await page.locator("#score .st-finger").first().textContent(), "1");
			await page.waitForSelector("canvas.falling");
			await page.click("text=Kuuntele >> nth=-1");
			await page.waitForTimeout(400);
			await page.click("text=Pysäytä");
			await page.emulateMedia({ media: "print" });
			assert.equal(await page.isVisible("canvas.falling"), false, "falling notes are not printed");
			assert.equal(await page.isVisible("#score svg >> nth=0"), true, "the score is printed");
			await page.emulateMedia({ media: "screen" });
		},
		"microphone: a played note is recognised (fake 440 Hz tone)": async () => {
			const page = await open("/laitteet/", { mode: "unsupported" });
			await page.click("text=Käytä mikrofonia");
			await page.waitForFunction(() => /Mikrofoni kuuli nuotin A4/.test(document.querySelector("#mic-h")?.parentElement?.textContent || ""), null, { timeout: 8000 });
			assert.equal(await page.getAttribute("#mic-toggle", "aria-pressed"), "true");
			await page.click("text=Lopeta mikrofonin käyttö");
			assert.equal(await page.getAttribute("#mic-toggle", "aria-pressed"), "false");
		},
		"rhythm: quiz round and a tap round": async () => {
			const page = await open("/rytmiharjoitus/?l=rhythm-values", { mode: "granted" });
			for (let i = 0; i < 10; i++) {
				await page.click(".answers button");
				await page.click(".feedback button");
			}
			await page.waitForSelector("#summary-h");
			const tap = await open("/rytmiharjoitus/?l=rhythm-play", { mode: "granted" });
			await tap.fill("#tempo", "120");
			await tap.click(".actions .btn-primary");
			await tap.waitForSelector(".results li", { timeout: 15000 });
		},
		"piece: Ukko Nooa in wait mode": async () => {
			const page = await open("/kappaleet/ukko-nooa/", { mode: "granted" });
			await page.waitForSelector("#score svg", { timeout: 15000 });
			await page.click("text=Harjoittele >> nth=-1");
			const steps = melodySteps(parseMelody(PIECES.find((p) => p.id === "ukko-nooa").right));
			for (const s of steps) for (const m of s.notes) await press(page, m);
			await page.waitForFunction(() => /Valmis/.test(document.querySelector(".feedback")?.textContent || ""), null, { timeout: 5000 });
		},
		"pieces: import MIDI, MusicXML and MXL": async () => {
			const midi = join(tmp, "test.mid");
			writeFileSync(midi, encodeSmf([60, 62, 64, 65].flatMap((n, i) => [{ type: "note", on: true, note: n, vel: 80, t: i * 500 }, { type: "note", on: false, note: n, t: i * 500 + 400 }])));
			const xml = join(tmp, "test.musicxml");
			const xmlText = toMusicXml({ title: "Testi", composer: "Test", fifths: 0, time: [4, 4], right: "C4q D4q E4q F4q | G4w" });
			writeFileSync(xml, xmlText);
			const mxl = join(tmp, "test.mxl");
			const enc = new TextEncoder();
			writeFileSync(
				mxl,
				zipStore([
					{ name: "META-INF/container.xml", data: enc.encode('<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>') },
					{ name: "score.xml", data: enc.encode(xmlText) },
				]),
			);
			for (const [file, selector] of [
				[midi, "#score svg"],
				[xml, "#score svg"],
				[mxl, "#score svg"],
			]) {
				const page = await open("/kappaleet/", { mode: "granted" });
				await page.waitForSelector("#import-file:not([disabled])");
				await Promise.all([page.waitForURL(/oma-kappale/), page.setInputFiles("#import-file", file)]);
				await page.waitForSelector(selector, { timeout: 15000 });
			}
		},
		"recorder: a session becomes a take that can be downloaded": async () => {
			const page = await open("/", { mode: "granted", settings: { idleSec: 1 } });
			await page.waitForFunction(() => document.getElementById("device-status")?.dataset.state === "on");
			for (const m of [60, 62, 64, 65, 67, 69]) await press(page, m);
			await page.waitForTimeout(1600);
			await page.goto(page.url().replace(/\/?$/, "") + "/paivakirja/");
			await page.waitForSelector(".results li button");
			const [dl] = await Promise.all([page.waitForEvent("download"), page.click("text=Lataa MIDI-tiedostona")]);
			assert.match(dl.suggestedFilename(), /\.mid$/);
			const [zip] = await Promise.all([page.waitForEvent("download"), page.click("text=Lataa kaikki tallenteet (.zip)")]);
			assert.match(zip.suggestedFilename(), /\.zip$/);
		},
		"sync: a code links two browsers, then the server copy is deleted": async (ctx) => {
			const a = await open("/asetukset/", { mode: "granted" });
			await a.evaluate(() =>
				localStorage.setItem("nt.v1.progress", JSON.stringify({ v: 1, devices: { aaaaaaaaaaaaaaaaaaaaaaaaaa: { updatedAt: 1, lessons: { keys: { single: { rounds: 1, best: 90, last: 90, lastAt: 1, notes: {} } } }, rhythm: {}, pieces: {}, practice: {} } } })),
			);
			await a.reload();
			await a.click("text=Luo synkronointikoodi");
			const code = (await a.textContent(".code", { timeout: 10000 })).trim();
			assert.match(code, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
			const b = await open("/asetukset/", { mode: "granted" });
			await b.fill("#sync-code", code.toLowerCase());
			await b.click('button:text-is("Yhdistä")');
			await b.waitForSelector(".code");
			const pb = await b.evaluate(() => JSON.parse(localStorage.getItem("nt.v1.progress")));
			assert.ok(pb.devices.aaaaaaaaaaaaaaaaaaaaaaaaaa, "device A's section arrived");
			await a.reload();
			await a.click("text=Poista tiedot palvelimelta");
			await a.click("text=Vahvista");
			await a.waitForSelector("text=Tiedot poistettu palvelimelta.");
			const res = await fetch(`${ctx.base}/api/sync/${code}`);
			assert.equal(res.status, 404);
		},
		"data: export and import with merge": async () => {
			const a = await open("/asetukset/", { mode: "granted" });
			await a.evaluate(() =>
				localStorage.setItem("nt.v1.progress", JSON.stringify({ v: 1, devices: { bbbbbbbbbbbbbbbbbbbbbbbbbb: { updatedAt: 2, lessons: { grand: { single: { rounds: 2, best: 80, last: 80, lastAt: 2, notes: {} } } }, rhythm: {}, pieces: {}, practice: { "2026-11-01": 300 } } } })),
			);
			await a.reload();
			const [dl] = await Promise.all([a.waitForEvent("download"), a.click("text=Vie edistyminen tiedostoksi (JSON)")]);
			const path = join(tmp, "export.json");
			await dl.saveAs(path);
			const b = await open("/asetukset/", { mode: "granted" });
			await b.setInputFiles("#import-json", path);
			await b.click("text=Yhdistä nykyiseen");
			await b.waitForSelector("text=Edistyminen tuotu.");
			const pb = await b.evaluate(() => JSON.parse(localStorage.getItem("nt.v1.progress")));
			assert.ok(pb.devices.bbbbbbbbbbbbbbbbbbbbbbbbbb);
		},
		"offline: pages and a drill work without a network": async (ctx) => {
			const page = await open("/", { mode: "granted" });
			await page.evaluate(async () => {
				await navigator.serviceWorker.ready;
			});
			await page.waitForFunction(
				async () => {
					const reg = await navigator.serviceWorker.ready;
					const s = await new Promise((r) => {
						const c = new MessageChannel();
						c.port1.onmessage = (e) => r(e.data);
						reg.active.postMessage({ type: "status" }, [c.port2]);
					});
					return s.done >= s.total - 40;
				},
				null,
				{ timeout: 30000, polling: 1000 },
			);
			await page.context().setOffline(true);
			await page.goto(`${ctx.base}/oppitunnit/ensimmaiset-nuotit/`);
			assert.match(await page.textContent("h1"), /Ensimmäiset nuotit/);
			await page.goto(`${ctx.base}/harjoitus/?l=keys&m=single`);
			await page.waitForSelector("section.question[data-key]", { timeout: 10000 });
			await page.context().setOffline(false);
		},
		"pwa: installable, fully cached, new pages, samples and photos work offline": async (ctx) => {
			const page = await open("/", { mode: "granted" });
			const cdp = await page.context().newCDPSession(page);
			const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
			// Test contexts are incognito, where Chrome never offers installing ("in-incognito");
			// Chromium lists every other problem too (manifest, icons, service worker), so the rest must be empty.
			const errors = installabilityErrors.filter((e) => e.errorId !== "in-incognito");
			assert.deepEqual(errors, [], `installability errors: ${JSON.stringify(errors)}`);
			const manifest = await (await fetch(`${ctx.base}/manifest.webmanifest`)).json();
			assert.equal(manifest.id, "/");
			assert.equal(manifest.display, "standalone");
			assert.ok(manifest.icons.some((i) => i.purpose === "maskable") && manifest.icons.some((i) => i.sizes === "512x512"));
			assert.ok(manifest.shortcuts.length >= 3 && manifest.shortcuts.every((s) => s.url.startsWith("/")));
			// Every shell file and the heavy files (samples, notation engine) end up cached.
			await page.waitForFunction(
				async () => {
					const reg = await navigator.serviceWorker.ready;
					const s = await new Promise((r) => {
						const c = new MessageChannel();
						c.port1.onmessage = (e) => r(e.data);
						reg.active.postMessage({ type: "status" }, [c.port2]);
					});
					return s.done === s.total;
				},
				null,
				{ timeout: 90000, polling: 1000 },
			);
			const sample = await page.evaluate(() => Object.values(JSON.parse(document.getElementById("nt-config").textContent).samples.urls)[0]);
			await page.context().setOffline(true);
			await page.goto(`${ctx.base}/vapaa-harjoitus/`);
			await page.waitForSelector("#free-clef");
			await page.goto(`${ctx.base}/kappaleet/chopin-preludi-e-molli/`);
			await page.waitForSelector("#score svg");
			assert.ok(await page.evaluate(async (u) => (await fetch(u)).ok, sample), "a piano sample loads offline");
			await page.goto(`${ctx.base}/`);
			await page.waitForFunction(() => {
				const img = document.querySelector(".photo img");
				return img && img.complete && img.naturalWidth > 0;
			}, null, { timeout: 10000 });
			await page.context().setOffline(false);
		},
		"stream: notes light up keys": async () => {
			const page = await open("/striimi/?bg=black", { mode: "granted" });
			await page.waitForSelector(".kbd .key");
			await page.waitForTimeout(400);
			await page.evaluate(() => window.__fakeMidi.press(60));
			await page.waitForSelector(".key.is-on");
		},
		"devices: Bluetooth and USB adapters, monitor and report": async () => {
			const page = await open("/laitteet/", { mode: "granted" });
			await page.click("text=Etsi Bluetooth-soitin");
			await page.waitForTimeout(200);
			await page.evaluate(() => window.__fakeBle.packet([0x80, 0x80, 0x90, 60, 100]));
			await page.waitForFunction(() => /Fake BLE Piano: 90 3c 64/.test(document.querySelector(".monitor")?.textContent || ""));
			await page.click("text=Valitse USB-soitin");
			await page.waitForTimeout(200);
			await page.evaluate(() => window.__fakeUsb.packet([0x09, 0x90, 62, 90]));
			await page.waitForFunction(() => /Fake USB Piano: 90 3e 5a/.test(document.querySelector(".monitor")?.textContent || ""));
			assert.match(await page.inputValue("#device-report"), /Web MIDI: yes/);
		},
		"devices: a USB keyboard held by the system driver gets a plain explanation": async () => {
			const page = await open("/laitteet/", { mode: "granted" });
			await page.evaluate(() => (window.__fakeUsbInUse = true));
			await page.click("text=Valitse USB-soitin");
			await page.waitForSelector("text=Tietokoneen oma MIDI-ajuri käyttää jo tätä soitinta");
			assert.ok(!(await page.content()).includes("Access denied"), "raw browser error not shown");
		},
	};
}
