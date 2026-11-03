// Pieces list: import own MusicXML / MXL / MIDI files. Files stay in this browser (IndexedDB)
// and are never uploaded; removing one asks for confirmation in the page (WCAG 3.3.6).
import { idb } from "../core/store.js";
import * as icons from "../content/icons.js";
import { $, boot, el } from "./common.js";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 50;
const ctx = await boot();
const { t } = ctx;
const input = $("#import-file");
const status = $("#import-status");
const list = $("#my-pieces");

function kindOf(bytes, name) {
	if (bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64) return "midi";
	if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "mxl";
	if (/\.(musicxml|xml)$/i.test(name)) return "xml";
	return null;
}

function confirmRemove(item, row) {
	const yes = el("button", { type: "button", className: "btn", icon: icons.trash, text: t("common.delete") });
	const no = el("button", { type: "button", className: "btn", text: t("common.cancel") });
	const prompt = el("p", { role: "alert", text: t("pieces.confirmRemove", { name: item.name }) });
	const box = el("div", { className: "actions" }, prompt, yes, no);
	row.append(box);
	no.focus();
	no.addEventListener("click", () => box.remove());
	yes.addEventListener("click", async () => {
		await idb.delete("pieces", item.id).catch(() => {});
		render();
	});
}

async function render() {
	let items = [];
	try {
		items = await idb.all("pieces");
	} catch {
		items = [];
	}
	items.sort((a, b) => b.added - a.added);
	list.replaceChildren(
		...items.map((item) => {
			const row = el("li", {});
			const remove = el("button", { type: "button", className: "btn-link", text: t("pieces.removeImported", { name: item.name }) });
			remove.addEventListener("click", () => confirmRemove(item, row));
			row.append(el("a", { className: "standalone", href: `${ctx.paths.myPiece}?id=${encodeURIComponent(item.id)}`, text: item.name }), " ", remove);
			return row;
		}),
	);
}

if (input) {
	input.disabled = false;
	input.addEventListener("change", async () => {
		const file = input.files?.[0];
		status.replaceChildren();
		if (!file) return;
		if (file.size > MAX_BYTES) {
			status.append(el("p", { className: "notice notice-bad", text: t("pieces.importTooBig") }));
			return;
		}
		const buf = await file.arrayBuffer();
		const kind = kindOf(new Uint8Array(buf), file.name);
		if (!kind) {
			status.append(el("p", { className: "notice notice-bad", text: t("pieces.importFailed") }));
			return;
		}
		let data = buf;
		if (kind === "xml") {
			data = new TextDecoder().decode(buf);
			if (!/<score-(partwise|timewise)/.test(data)) {
				status.append(el("p", { className: "notice notice-bad", text: t("pieces.importFailed") }));
				return;
			}
		}
		const existing = await idb.all("pieces").catch(() => []);
		if (existing.length >= MAX_FILES) {
			existing.sort((a, b) => a.added - b.added);
			await idb.delete("pieces", existing[0].id).catch(() => {});
		}
		const id = String(Date.now());
		try {
			await idb.put("pieces", { id, name: file.name.replace(/\.[^.]+$/, ""), kind, data, added: Date.now() });
		} catch {
			status.append(el("p", { className: "notice notice-bad", text: t("common.storageBlocked") }));
			return;
		}
		location.href = `${ctx.paths.myPiece}?id=${id}`;
	});
}
render();
