#!/usr/bin/env node
// Vendors the prebuilt OpenSheetMusicDisplay bundle (BSD-3-Clause) into src/vendor/osmd/.
//
// Why vendored instead of an npm dependency: the npm package has an optional native
// dependency (`gl`) that Cloudflare Workers Builds would try to compile on every deploy.
// We only need the single browser bundle, so we copy it once and pin it by sha256.
//
// Usage: node scripts/vendor-osmd.mjs [version]     (default: the version in VERSION.json)
// Needs: npm and network access to the npm registry. Writes:
//   src/vendor/osmd/opensheetmusicdisplay.min.js, LICENSE, VERSION.json
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src/vendor/osmd");
const versionFile = join(outDir, "VERSION.json");
const current = existsSync(versionFile) ? JSON.parse(readFileSync(versionFile, "utf8")) : {};
const version = process.argv[2] || current.version;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
	console.error("usage: vendor-osmd.mjs <exact version, e.g. 2.2.1>");
	process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "osmd-vendor-"));
try {
	// npm pack verifies the registry integrity hash; --ignore-scripts keeps it inert.
	const tgz = execFileSync("npm", ["pack", `opensheetmusicdisplay@${version}`, "--ignore-scripts", "--silent"], {
		cwd: work,
		encoding: "utf8",
	}).trim();
	execFileSync("tar", ["-xzf", tgz], { cwd: work });
	const pkg = join(work, "package");
	const bundle = join(pkg, "build/opensheetmusicdisplay.min.js");
	mkdirSync(outDir, { recursive: true });
	copyFileSync(bundle, join(outDir, "opensheetmusicdisplay.min.js"));
	copyFileSync(join(pkg, "LICENSE"), join(outDir, "LICENSE"));
	const sha256 = createHash("sha256").update(readFileSync(bundle)).digest("hex");
	const meta = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
	const info = {
		name: "opensheetmusicdisplay",
		version,
		license: meta.license,
		file: "opensheetmusicdisplay.min.js",
		sha256,
		bundles: { vexflow: meta.dependencies?.vexflow, jszip: meta.dependencies?.jszip },
	};
	writeFileSync(versionFile, `${JSON.stringify(info, null, 2)}\n`);
	console.log(`vendored opensheetmusicdisplay ${version} sha256=${sha256}`);
} finally {
	rmSync(work, { recursive: true, force: true });
}
