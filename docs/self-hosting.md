# Running your own copy

Anyone can run a copy of Nuottitreeni for free on Cloudflare, for example for a music school or a family. Each copy is independent: its own address, its own sync database, its own operator.

## With the Deploy to Cloudflare button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Markus-web/nuottitreeni)

1. Click the button and sign in to Cloudflare (a free account is enough) and to GitHub or GitLab.
2. Choose a name for the Worker and the new repository. Cloudflare creates the repository in your account, a D1 database for sync codes and a Worker connected to the repository (Workers Builds).
3. Keep the suggested build command `npm run build` and deploy command `npm run deploy`. The deploy command applies the database migrations before deploying.
4. After the first deploy the site is at `https://<worker-name>.<your-subdomain>.workers.dev`.

Then:

- **Name yourself as the operator.** Edit `wrangler.jsonc` in your new repository: set `OPERATOR_NAME` and `OPERATOR_CONTACT` under `vars`. Every push redeploys. The privacy notice and accessibility statement show these values.
- **Own domain (optional).** Worker, **Settings**, **Domains & Routes**, **Add**, **Custom domain**. The domain's DNS must be on Cloudflare.
- **Search engines (optional).** By default a copy is `noindex`. To be found, set the build variables `NT_SITE_URL=https://your.domain` and `NT_INDEXABLE=1` ([configuration.md](configuration.md)) and redeploy.
- **Language.** `NT_LOCALES=fi,en` and `NT_DEFAULT_LOCALE=fi` serve Finnish at `/`.

## By hand with Wrangler

```bash
git clone https://github.com/Markus-web/nuottitreeni.git
cd nuottitreeni
npm ci
npx wrangler login
npx wrangler d1 create nuottitreeni     # paste the database_id into wrangler.jsonc
npm run build                           # add NT_* variables as needed
npm run deploy                          # migrations, then wrangler deploy
```

To keep the sync data stored inside the EU, create the database with `npx wrangler d1 create nuottitreeni --jurisdiction eu` (the official instance does this).

For a long-lived setup, keep your own `wrangler.jsonc` (Worker name, database id, routes, `vars`) next to the clone and deploy with `npx wrangler deploy --config path/to/your/wrangler.jsonc`, so updates from upstream never touch it. Paths in that file (`main`, `assets.directory`, `migrations_dir`) are relative to the file itself.

## Updating

The button creates a copy, not a fork, so pull changes from upstream yourself:

```bash
git remote add upstream https://github.com/Markus-web/nuottitreeni.git   # once
git fetch upstream
git merge upstream/main          # keep your own name, database_id and vars in wrangler.jsonc
git push                         # Workers Builds rebuilds and redeploys
```

Read [CHANGELOG.md](../CHANGELOG.md) first. New migrations are applied by `npm run deploy`. Stored progress stays compatible within a major version.

## Backups

The sync database holds practice statistics only, and users can export their own data, so backups are optional. To take one:

```bash
npx wrangler d1 export nuottitreeni --remote --output nuottitreeni-backup.sql
```

D1 also keeps point-in-time history (Time Travel) for restoring the database to an earlier minute; see Cloudflare's D1 documentation for the retention on your plan.

## Turning sync off

Set `SYNC_ENABLED` to `"false"` in `wrangler.jsonc` and redeploy. The app then offers only local storage and file export and import. Existing records stay in D1 until the daily cleanup removes them after 365 days, or until you delete the database.

## Costs and limits

Pages, scripts, samples and photos are static assets, which do not count as Worker requests. Only `/api/*` (sync, config, health) runs the Worker, so a copy with many visitors stays well inside the free plan's daily request limit. D1 use is tiny: one row per sync code.

## Checking a deployment

```bash
npm run prove:live -- --base https://your.domain
```

It checks TLS, headers, the API, the crawl files and a full sync round trip that deletes its own record. Add `--browser` to run axe and Lighthouse too (needs the browser test packages and Chromium).

## Removing a copy

Delete the Worker and the D1 database in the Cloudflare dashboard (Workers & Pages, and Storage & Databases, D1), and the repository if you no longer need it. Users keep their local data and can export it before you remove the site.
