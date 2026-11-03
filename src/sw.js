// Service worker (template; scripts/build.mjs fills BUILD, SHELL and HEAVY and minifies it).
// Pages: network first with a 3 s timeout, then the cache, so online users always get the
// latest version and offline users still get a page. Hashed assets: cache first.
// /api/*: network only, never cached. Heavy files (piano samples, notation engine) are cached
// after install in the background, or on request from Settings ("cache-heavy"). Photos: the
// smallest AVIF of each is in SHELL; offline, any cached size of the same photo stands in.
const BUILD = "__BUILD__";
const SHELL = [] /* __SHELL__ */;
const HEAVY = [] /* __HEAVY__ */;
const SHELL_CACHE = `nt-shell-${BUILD}`;
const HEAVY_CACHE = `nt-heavy-${BUILD}`;

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(SHELL_CACHE).then((cache) =>
			Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => null))),
		),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k.startsWith("nt-") && k !== SHELL_CACHE && k !== HEAVY_CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
			.then(() => cacheHeavy()),
	);
});

async function cacheHeavy() {
	const cache = await caches.open(HEAVY_CACHE);
	for (const url of HEAVY) {
		if (!(await cache.match(url))) await cache.add(url).catch(() => null);
	}
}

async function status() {
	const shell = await caches.open(SHELL_CACHE);
	const heavy = await caches.open(HEAVY_CACHE);
	let done = 0;
	for (const url of SHELL) if (await shell.match(url)) done++;
	for (const url of HEAVY) if (await heavy.match(url)) done++;
	return { done, total: SHELL.length + HEAVY.length, build: BUILD };
}

self.addEventListener("message", (event) => {
	const type = event.data?.type;
	const reply = (data) => event.ports?.[0]?.postMessage(data);
	if (type === "skip-waiting") self.skipWaiting();
	else if (type === "status") status().then(reply);
	else if (type === "cache-heavy") cacheHeavy().then(status).then(reply);
});

/** Offline stand-in for /assets/photos/<id>-<width>-<hash>.<ext>: another cached size, same format. */
async function photoFallback(url) {
	const m = /^\/assets\/photos\/([a-z0-9-]+)-\d+-[0-9a-f]+\.(avif|webp)$/.exec(url.pathname);
	if (!m) return Response.error();
	for (const name of await caches.keys()) {
		if (!name.startsWith("nt-")) continue;
		const cache = await caches.open(name);
		const key = (await cache.keys()).find((k) => {
			const p = new URL(k.url).pathname;
			return p.startsWith(`/assets/photos/${m[1]}-`) && p.endsWith(`.${m[2]}`) && /^\d+-/.test(p.slice(`/assets/photos/${m[1]}-`.length));
		});
		if (key) return cache.match(key);
	}
	return Response.error();
}

function timeout(ms) {
	return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
	if (req.mode === "navigate") {
		event.respondWith(
			Promise.race([fetch(req), timeout(3000)])
				.then((res) => {
					if (res.ok) {
						const copy = res.clone();
						caches.open(SHELL_CACHE).then((c) => c.put(url.pathname, copy));
					}
					return res;
				})
				.catch(async () => (await caches.match(url.pathname, { ignoreSearch: true })) || (await caches.match("/", { ignoreSearch: true })) || Response.error()),
		);
		return;
	}
	if (url.pathname.startsWith("/assets/") || url.pathname === "/manifest.webmanifest") {
		event.respondWith(
			caches.match(req, { ignoreSearch: true }).then(
				(hit) =>
					hit ||
					fetch(req).then((res) => {
						if (res.ok && res.type === "basic") {
							const copy = res.clone();
							caches.open(url.pathname.startsWith("/assets/piano/") || url.pathname.startsWith("/assets/vendor/") ? HEAVY_CACHE : SHELL_CACHE).then((c) => c.put(req, copy));
						}
						return res;
					}),
			)
			.catch(() => (url.pathname.startsWith("/assets/photos/") ? photoFallback(url) : Response.error())),
		);
	}
});
