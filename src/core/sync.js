// Sync client for the optional sync codes (API contract: docs/api.md). The local document is
// the source of truth for this device; the server copy is merged in with mergeProgress, which
// never double counts because each device only writes its own section.
// Events: "status" detail { state: "idle"|"syncing"|"synced"|"offline"|"failed"|"rate-limited"|"gone" }.
import { mergeProgress, pruneDevices } from "./progress.js";
import { normalizeCode } from "./sync-code.js";
import { getProgress, getSettings, getSyncState, saveProgress, saveSyncState } from "./store.js";

export class SyncError extends Error {
	constructor(code, status) {
		super(code);
		this.code = code;
		this.status = status;
	}
}

async function api(method, path, body) {
	let res;
	try {
		res = await fetch(path, {
			method,
			headers: body === undefined ? {} : { "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: "same-origin",
			cache: "no-store",
		});
	} catch {
		throw new SyncError("OFFLINE", 0);
	}
	const data = res.status === 204 ? null : await res.json().catch(() => null);
	if (!res.ok && res.status !== 409) throw new SyncError(data?.code || "FAILED", res.status);
	return { status: res.status, data };
}

export class SyncClient extends EventTarget {
	constructor() {
		super();
		this.timer = null;
		this.busy = false;
		addEventListener("nt-progress", () => this.schedule());
		addEventListener("online", () => this.schedule(500));
	}

	get state() {
		return getSyncState();
	}

	emit(state, extra = {}) {
		this.dispatchEvent(new CustomEvent("status", { detail: { state, ...extra } }));
	}

	schedule(delay = 3000) {
		const st = getSyncState();
		if (!st.code || !getSettings().autoSync) return;
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.syncNow().catch(() => {}), delay);
	}

	async create() {
		const local = pruneDevices(getProgress());
		const { data } = await api("POST", "/api/sync", { data: local });
		saveSyncState({ code: data.code, rev: data.rev, lastSyncAt: Date.now() });
		this.emit("synced");
		return data.code;
	}

	async link(input) {
		const code = normalizeCode(input);
		if (!code) throw new SyncError("BAD_CODE", 400);
		const formatted = code.match(/.{4}/g).join("-");
		const { data } = await api("GET", `/api/sync/${formatted}`);
		const merged = pruneDevices(mergeProgress(getProgress(), data.data));
		saveProgress(merged);
		saveSyncState({ code: formatted, rev: data.rev, lastSyncAt: Date.now() });
		await this.syncNow();
		return formatted;
	}

	async syncNow() {
		const st = getSyncState();
		if (!st.code || this.busy) return;
		if (typeof navigator !== "undefined" && navigator.onLine === false) {
			this.emit("offline");
			return;
		}
		this.busy = true;
		this.emit("syncing");
		try {
			let rev = st.rev;
			for (let attempt = 0; attempt < 3; attempt++) {
				const local = pruneDevices(getProgress());
				const { status, data } = await api("PUT", `/api/sync/${st.code}`, { baseRev: rev, data: local });
				if (status === 200) {
					saveSyncState({ code: st.code, rev: data.rev, lastSyncAt: Date.now() });
					this.emit("synced");
					return;
				}
				// 409: someone else saved first. Merge their copy in and try again.
				saveProgress(pruneDevices(mergeProgress(getProgress(), data.data)));
				rev = data.rev;
			}
			throw new SyncError("CONFLICT", 409);
		} catch (e) {
			if (e.code === "OFFLINE") this.emit("offline");
			else if (e.status === 429) this.emit("rate-limited");
			else if (e.status === 404) {
				saveSyncState({ code: null, rev: 0, lastSyncAt: 0 });
				this.emit("gone");
			} else this.emit("failed");
			throw e;
		} finally {
			this.busy = false;
		}
	}

	async download() {
		const st = getSyncState();
		if (!st.code) return null;
		const { data } = await api("GET", `/api/sync/${st.code}`);
		return data;
	}

	async deleteServer() {
		const st = getSyncState();
		if (!st.code) return;
		await api("DELETE", `/api/sync/${st.code}`);
		this.unlink();
	}

	unlink() {
		saveSyncState({ code: null, rev: 0, lastSyncAt: 0 });
		this.emit("idle");
	}
}
