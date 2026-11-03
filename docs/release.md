# Releasing

For maintainers. Versions follow Semantic Versioning: a major version for any change to stored data or the sync API that old clients cannot read, a minor version for features, a patch for fixes.

1. Make sure `main` is green in CI and `npm run check` passes locally.
2. Update `version` in `package.json` (it is shown in the footer and returned by `/api/health`) and run `npm install --package-lock-only` so the lockfile matches.
3. Move the `Unreleased` entries in [CHANGELOG.md](../CHANGELOG.md) under the new version with today's date, and update the compare links at the bottom.
4. Commit (`chore(release): vX.Y.Z`), tag `vX.Y.Z` and push the tag.
5. Create the GitHub release from the tag with the changelog section as notes: `gh release create vX.Y.Z --notes-file <section>`.
6. Deploy the instances you run and prove them: `npm run deploy` (or your own deploy script), then `npm run prove:live -- --base https://your.domain`.

Self-hosters follow the steps in [self-hosting.md](self-hosting.md#updating).

## New database migrations

Add a new numbered file in `migrations/` (never edit an applied one). Migrations must work on a database that already has data and must not need a secret. `npm run deploy` applies them before the new Worker goes live, so the old Worker briefly runs against the new schema: add columns and tables first, and remove old ones only in a later release.
