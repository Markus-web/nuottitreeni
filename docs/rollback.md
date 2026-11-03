# Rolling back a deployment

Use this when a new version breaks an instance. Users' progress lives in their browsers, so a rollback never loses their data; only sync records live on the server.

## Signals that call for a rollback

- `npm run prove:live -- --base https://your.domain` fails after a deploy.
- Pages do not load, or the browser console shows errors on every page.
- `/api/health` does not answer, or sync fails for everyone (`5xx` responses).
- Lessons or pieces show wrong notes after a content change.

## Roll back the Worker and the site

Pages and the Worker are deployed together as one Worker version, so rolling back the version restores both.

```bash
npx wrangler deployments list                 # find the last good version
npx wrangler rollback <version-id> --message "rollback: <reason>"
```

Or in the dashboard: Workers & Pages, your Worker, **Deployments**, **Rollback** on the last good version. Then run `prove:live` again.

With Workers Builds (the Deploy button), also revert the bad commit in your repository, otherwise the next push deploys it again:

```bash
git revert <bad-commit>
git push
```

## Service worker caches

Visitors who loaded the bad version keep it until the service worker sees a new one. A rollback produces a new `sw.js` build id, so their browser installs it in the background and the page offers an update. Nothing else is needed. If the bad version broke the update itself, deploy a fixed version: `sw.js` is served with `Cache-Control: no-cache`, so browsers always check it.

## Database

Migrations are only ever additive (see [release.md](release.md#new-database-migrations)), so the previous Worker version runs on the newer schema and the database normally needs no rollback.

If data was damaged, D1 Time Travel restores the database to an earlier point:

```bash
npx wrangler d1 time-travel info nuottitreeni --timestamp <ISO time before the deploy>
npx wrangler d1 time-travel restore nuottitreeni --timestamp <ISO time before the deploy>
```

A restore drops sync records written after that time; users' browsers still hold their data and resync on the next visit, so the loss heals itself for users who come back.

## After a rollback

Write down what happened (time, signal, cause, fix) in the issue or pull request that fixes it, and add a test that would have caught it.
