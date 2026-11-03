// Builds the site and runs it with `wrangler dev` (local workerd + local D1) for browser tests.
// The build uses an "official instance" style configuration so SEO tags, the baked operator
// and indexing are exercised; pass template: true to test the deploy-button defaults instead.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ROOT = new URL("../../../", import.meta.url).pathname;
const WRANGLER = join(ROOT, "node_modules/.bin/wrangler");

export const TEST_SITE = {
	NT_SITE_URL: "https://piano.example",
	NT_INDEXABLE: "1",
	NT_DEFAULT_LOCALE: "fi",
	NT_LOCALES: "fi,en",
	NT_OPERATOR_NAME: "Test Operator",
	NT_OPERATOR_CONTACT: "ops@example.org",
	NT_OPERATOR_PLACE: "Testila",
};

function freePort(preferred) {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.once("error", () => {
			const s2 = createServer();
			s2.listen(0, "127.0.0.1", () => {
				const { port } = s2.address();
				s2.close(() => resolve(port));
			});
		});
		srv.listen(preferred, "127.0.0.1", () => srv.close(() => resolve(preferred)));
	});
}

export function build({ template = false } = {}) {
	const env = { ...process.env, ...(template ? {} : TEST_SITE) };
	if (template) for (const k of Object.keys(TEST_SITE)) delete env[k];
	execFileSync(process.execPath, [join(ROOT, "scripts/build.mjs")], { cwd: ROOT, env, stdio: "inherit" });
}

export async function startServer({ port = 8797 } = {}) {
	const state = mkdtempSync(join(tmpdir(), "nt-wrangler-"));
	execFileSync(WRANGLER, ["d1", "migrations", "apply", "DB", "--local", "--persist-to", state], { cwd: ROOT, stdio: "ignore", env: { ...process.env, CI: "1" } });
	const p = await freePort(port);
	const child = spawn(WRANGLER, ["dev", "--port", String(p), "--ip", "127.0.0.1", "--persist-to", state, "--log-level", "error", "--show-interactive-dev-session=false"], {
		cwd: ROOT,
		stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, CI: "1" },
	});
	let log = "";
	child.stdout.on("data", (d) => (log += d));
	child.stderr.on("data", (d) => (log += d));
	const base = `http://127.0.0.1:${p}`;
	for (let i = 0; i < 120; i++) {
		try {
			const r = await fetch(`${base}/api/health`);
			if (r.ok) return { base, stop: () => (child.kill("SIGTERM"), rmSync(state, { recursive: true, force: true })), log: () => log };
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	child.kill("SIGTERM");
	throw new Error(`wrangler dev did not start:\n${log}`);
}
