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

## Other hosts (without sync codes)

The site itself is plain static files in `dist/`; only the optional sync codes need the Worker and D1. Any static host can serve the rest: lessons, pieces, MIDI keyboards, the microphone, recordings, export and import, offline use. When there is no sync API, the Settings page says that sync is not available on this site.

Build first, with the build variables you want ([configuration.md](configuration.md)):

```bash
npm ci && npm run build      # the site is now in dist/
```

| Host | How | Notes |
|---|---|---|
| Netlify | Publish directory `dist`, build command `npm run build` | Reads the generated `dist/_headers` (same format as Cloudflare) and serves `404.html` |
| Cloudflare Pages | `npx wrangler pages deploy dist` | Reads `_headers`; no Worker, so no sync |
| GitHub Pages | Publish the contents of `dist/` | Only at the root of a domain (a custom domain or a `username.github.io` repository): the pages use root paths such as `/assets/`. GitHub Pages cannot send the security headers |
| Your own web server (nginx, Caddy, Apache) | Serve `dist/` as the document root; folders have `index.html`, unknown paths should get `404.html` | Copy the headers from `dist/_headers` into the server configuration |

## On your own computer or server

| Way | Command | Sync |
|---|---|---|
| Development server (Wrangler, local D1) | `npm run dev`, then <http://127.0.0.1:8797/> | Yes, stored locally |
| Small built-in server (Node only, no other dependencies) | `npm run build && npm run serve`, then <http://localhost:8080/> | No |
| Docker | `docker build -t nuottitreeni . && docker run --rm -p 127.0.0.1:8080:8080 nuottitreeni` | No |

`npm run serve` (`scripts/serve.mjs`) applies the same security and cache headers as Cloudflare. Options: `--port`, `--host` (use `0.0.0.0` to listen on the network), `--dir`; `OPERATOR_NAME` and `OPERATOR_CONTACT` work as on Cloudflare. The Docker image takes the build variables as build arguments, for example `--build-arg NT_LOCALES=fi,en --build-arg NT_OPERATOR_NAME="Music school"`.

**HTTPS on a home network.** Browsers allow MIDI keyboards, the microphone and offline use only in a secure context: `http://localhost` on the same computer is fine, but `http://192.168.x.x` from a tablet is not. Put an HTTPS reverse proxy in front of the server (for example Caddy, or Tailscale Serve for devices on your tailnet); the proxy should send `X-Forwarded-Proto: https`, so the server also sends the HTTPS-only headers.

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

## Cloudflare zone features

If your domain's zone has Web Analytics (automatic setup), Zaraz or Rocket Loader turned on, Cloudflare would inject their scripts into the pages. The pages carry `Cache-Control: no-transform`, which Cloudflare honours, so nothing is injected and the privacy notice stays true; the zone then does not compress the HTML (assets are still compressed). Zone-wide security headers (managed transforms) may also replace `Referrer-Policy`, `X-Frame-Options` or HSTS with their own values; `prove:live` accepts values that are at least as strict and lists them as notes.

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
