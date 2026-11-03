#!/usr/bin/env node
// Serves a built site (dist/) without Cloudflare: on your own computer, a home server, a
// Raspberry Pi or in Docker. Zero dependencies (node:http). Applies the same security and
// cache headers as the Cloudflare deployment (worker/headers.js), serves /folder/index.html
// for /folder/, the 404 page for unknown paths, and answers /api/config with sync turned off
// (the sync API needs Cloudflare D1; everything else works, including offline use).
//
// Usage: npm run build && node scripts/serve.mjs [--dir dist] [--port 8080] [--host 127.0.0.1]
// Environment: OPERATOR_NAME, OPERATOR_CONTACT (shown on the privacy page, as on Cloudflare).
//
// MIDI keyboards, the microphone and offline use need a secure context: open the site as
// http://localhost (or 127.0.0.1) on the same computer, or put HTTPS in front of this server
// (docs/self-hosting.md). A plain http:// address on the local network is not enough.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSET_CACHE, PAGE_CACHE, SECURITY_HEADERS } from "../worker/headers.js";

const TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".avif": "image/avif",
	".webp": "image/webp",
	".woff2": "font/woff2",
	".mp3": "audio/mpeg",
	".musicxml": "application/vnd.recordare.musicxml+xml",
	".xml": "application/xml; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
};

/** Security headers for one response; plain http drops upgrade-insecure-requests (localhost). */
export function headersFor(path, secure) {
	const h = { ...SECURITY_HEADERS };
	if (!secure) {
		h["Content-Security-Policy"] = h["Content-Security-Policy"].replace(/;\s*upgrade-insecure-requests/, "");
		delete h["Strict-Transport-Security"];
	}
	h["Cache-Control"] = path.startsWith("/assets/") ? ASSET_CACHE : path === "/sw.js" ? "no-cache" : PAGE_CACHE;
	return h;
}

/** Map a URL path to a file inside root, or null. Never leaves root. */
export function fileFor(root, urlPath) {
	let path;
	try {
		path = decodeURIComponent(urlPath.split("?")[0]);
	} catch {
		return null;
	}
	if (path.includes("\0")) return null;
	const full = resolve(root, `.${path}`);
	if (full !== root && !full.startsWith(root + sep)) return null;
	if (path.endsWith("/")) return existsSync(join(full, "index.html")) ? join(full, "index.html") : null;
	return existsSync(full) && statSync(full).isFile() ? full : null;
}

export function createSiteServer({ dir, operatorName = "", operatorContact = "" }) {
	const root = resolve(dir);
	return createServer((req, res) => {
		const secure = req.headers["x-forwarded-proto"] === "https";
		const url = new URL(req.url, "http://localhost");
		const send = (status, headers, body) => {
			res.writeHead(status, headers);
			res.end(body);
		};
		if (req.method !== "GET" && req.method !== "HEAD") return send(405, { Allow: "GET, HEAD" }, "");
		if (url.pathname.startsWith("/api/")) {
			const json = (status, body) => send(status, { ...headersFor(url.pathname, secure), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, JSON.stringify(body));
			if (url.pathname === "/api/config") return json(200, { operatorName, operatorContact, syncEnabled: false });
			if (url.pathname === "/api/health") return json(200, { ok: true, app: "nuottitreeni", server: "serve.mjs" });
			return json(404, { error: true, code: "SYNC_DISABLED", message: "Sync is not available on this server." });
		}
		// /lessons/x -> /lessons/x/ (same as auto-trailing-slash on Cloudflare).
		if (!url.pathname.endsWith("/") && !extname(url.pathname) && fileFor(root, `${url.pathname}/`)) return send(301, { Location: `${url.pathname}/${url.search}` }, "");
		const file = fileFor(root, url.pathname);
		if (!file) {
			const notFound = join(root, "404.html");
			return send(404, { ...headersFor(url.pathname, secure), "Content-Type": TYPES[".html"] }, existsSync(notFound) && req.method === "GET" ? readFileSync(notFound) : "");
		}
		res.writeHead(200, { ...headersFor(url.pathname, secure), "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Content-Length": statSync(file).size });
		if (req.method === "HEAD") return res.end();
		createReadStream(file).pipe(res);
	});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
	const dir = opt("--dir", join(fileURLToPath(new URL("..", import.meta.url)), "dist"));
	const port = Number(opt("--port", process.env.PORT || "8080"));
	const host = opt("--host", process.env.HOST || "127.0.0.1");
	if (!existsSync(join(dir, "index.html"))) {
		console.error(`no built site in ${dir}: run npm run build first`);
		process.exit(1);
	}
	createSiteServer({ dir, operatorName: process.env.OPERATOR_NAME || "", operatorContact: process.env.OPERATOR_CONTACT || "" }).listen(port, host, () => {
		const shown = host === "0.0.0.0" ? "localhost" : host;
		console.log(`Nuottitreeni at http://${shown}:${port}/ (sync off; Ctrl+C stops)`);
	});
}
