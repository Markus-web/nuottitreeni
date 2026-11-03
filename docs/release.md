# Releasing

For maintainers. Versions follow Semantic Versioning: a major version for any change to stored data or the sync API that old clients cannot read, a minor version for features, a patch for fixes.

`main` takes changes only through pull requests that passed CI ([decision 0011](decisions/0011-stable-main.md)), so a release is a pull request too.

1. Run `npm run check` locally (everything CI runs) and go through the [audit checklist](audit-checklist.md).
2. Update `version` in `package.json` (it is shown in the footer and returned by `/api/health`) and run `npm install --package-lock-only` so the lockfile matches.
3. Move the `Unreleased` entries in [CHANGELOG.md](../CHANGELOG.md) under the new version with today's date, and update the compare links at the bottom.
4. Commit (`chore(release): vX.Y.Z`) on a branch, open a pull request with the changelog section as its description and turn on auto-merge (`gh pr merge --auto --squash`). It merges when CI passes; if a job fails, fix it on the branch.
5. Tag the merged commit on `main` (`git tag -a vX.Y.Z -m "Release vX.Y.Z" <commit>`), push the tag and create the GitHub release with the changelog section as notes: `gh release create vX.Y.Z --notes-file <section> --verify-tag`.
6. Deploy the instances you run and prove them: `npm run deploy` (or your own deploy script), then `npm run prove:live -- --base https://your.domain --browser`.

Self-hosters follow the steps in [self-hosting.md](self-hosting.md#updating).

## Dependency updates

New releases of dependencies are taken only when they are at least 14 days old (Dependabot has a 14-day cooldown), so a broken or compromised release has time to be noticed upstream. The exception is a release that fixes a known security advisory in a version we use: then the fixed version is taken at once (Dependabot security updates skip the cooldown too). Example: Wrangler 4.153.0 was taken 8 days after release because every earlier 4.x pulls in an `undici` with high-severity advisories. Check with `npm audit` and `npm --prefix tests/browser audit`; both must report 0 vulnerabilities before a release.

## New database migrations

Add a new numbered file in `migrations/` (never edit an applied one). Migrations must work on a database that already has data and must not need a secret. `npm run deploy` applies them before the new Worker goes live, so the old Worker briefly runs against the new schema: add columns and tables first, and remove old ones only in a later release.
