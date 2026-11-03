#!/usr/bin/env node
// Runs everything CI runs (`npm run check`) in a fresh copy of the project, so files that exist
// only on this computer (ignored builds, node_modules, local settings) cannot hide a problem.
// The copy holds the files Git tracks plus new files that are not ignored, like a commit would.
//
// Usage: npm run check:fresh [-- --keep]   (--keep leaves the copy and prints its path)
// Needs: git, npm, Chromium for the browser suite (CHROMIUM_PATH, see docs/testing.md).
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "."], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const copy = mkdtempSync(join(tmpdir(), "nuottitreeni-fresh-"));
for (const f of files) {
	mkdirSync(dirname(join(copy, f)), { recursive: true });
	try {
		copyFileSync(join(root, f), join(copy, f));
	} catch {
		/* deleted in the working tree but still tracked: a commit would drop it too */
	}
}
console.log(`fresh copy: ${files.length} files in ${copy}`);

const run = (args, extra = {}) => {
	console.log(`\n$ npm ${args.join(" ")}`);
	const r = spawnSync("npm", args, { cwd: copy, stdio: "inherit", ...extra });
	return r.status === 0;
};
const ok =
	run(["ci", "--ignore-scripts"]) &&
	run(["ci", "--prefix", "tests/browser", "--ignore-scripts"]) &&
	run(["audit", "--audit-level=moderate"]) &&
	run(["audit", "--prefix", "tests/browser", "--audit-level=moderate"]) &&
	run(["run", "check"]);

if (keep) console.log(`\nkept: ${copy}`);
else rmSync(copy, { recursive: true, force: true });
console.log(ok ? "\nfresh check passed" : "\nfresh check FAILED");
process.exit(ok ? 0 : 1);
