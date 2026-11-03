# Configuration

There are two kinds of settings: **build variables**, read by `scripts/build.mjs` when the site is built, and **runtime variables and bindings**, read by the Worker. All are optional; the defaults give a working, private copy that search engines are asked not to index.

## Build variables

Set them in the shell (`NT_SITE_URL=https://... npm run build`) or, for a copy deployed with the button, in the Cloudflare dashboard: Workers & Pages, your Worker, **Settings**, **Build**, **Variables and secrets** (build variables, not runtime variables). The next build uses them.

| Variable | Default | Effect |
|---|---|---|
| `NT_SITE_URL` | empty | The public address, `https://host` without a path. Enables absolute canonical links, `hreflang`, the sitemap, Open Graph image URLs and absolute links in `llms.txt`. |
| `NT_INDEXABLE` | `0` | `1` lets search engines index the guide pages (needs `NT_SITE_URL`). With `0` every page is `noindex` and `robots.txt` disallows everything, so copies do not compete with each other in search results. |
| `NT_LOCALES` | `en,fi` | Locales to build; each needs `src/content/locales/<code>.js`. |
| `NT_DEFAULT_LOCALE` | first of `NT_LOCALES` | The locale served at `/`; the others live under `/<code>/`. |
| `NT_OPERATOR_NAME` | empty | Who runs the copy, written into the privacy notice, accessibility statement and footer at build time. When empty, pages ask `/api/config` (the runtime variable below). |
| `NT_OPERATOR_CONTACT` | empty | Email address or `https://` URL for privacy and accessibility questions. |
| `NT_OPERATOR_PLACE` | empty | Optional town or country after the operator's name in the privacy notice. |
| `NT_SOURCE_URL` | `https://github.com/Markus-web/nuottitreeni` | The "source code" link in the footer and on the About page. Point it at your fork if you change the code (the MIT licence does not require it, but it is good practice). |
| `NT_SKIP_BUDGET` | empty | `1` reports size budgets without failing the build. |
| `NT_OUT_DIR` | `dist` | Output directory (the tests build into temporary directories). |
| `SOURCE_DATE_EPOCH` | last commit date | Date used for `lastmod` in the sitemap. |

## Runtime variables

Set in `wrangler.jsonc` under `vars`, or in the dashboard: your Worker, **Settings**, **Variables and secrets**. A dashboard value is replaced by the `wrangler.jsonc` value on the next deploy unless you also change the file; for a long-lived copy, edit `wrangler.jsonc` in your repository.

| Variable | Default | Effect |
|---|---|---|
| `OPERATOR_NAME` | `""` | Operator name served by `/api/config`, used by pages built without `NT_OPERATOR_NAME`. |
| `OPERATOR_CONTACT` | `""` | Operator contact served by `/api/config`. |
| `SYNC_ENABLED` | `"true"` | `"false"` turns off sync codes: the API answers `404 SYNC_DISABLED` and the Settings page offers only export and import. |

No secrets are needed. The rate-limit salt is generated inside D1 by the first migration.

## Bindings

| Binding | Type | Used for |
|---|---|---|
| `DB` | D1 database | Sync records, rate-limit counters, the salt (`migrations/0001_init.sql`) |
| `ASSETS` | Static assets (`./dist`) | Every page and file; the Worker runs only for `/api/*` (`run_worker_first`) |

## Other settings in `wrangler.jsonc`

- `observability.enabled: false`: no request logs are kept. Turning it on means request data (including IP addresses) is logged by Cloudflare; update your privacy notice if you do.
- `triggers.crons`: the daily cleanup (records idle for 365 days, rate rows older than two days).
- `assets.not_found_handling: "404-page"` serves `dist/404.html`; `html_handling: "auto-trailing-slash"` keeps the `/page/` URLs.

## Example: the official instance

```bash
NT_SITE_URL=https://piano.markussilvo.fi \
NT_INDEXABLE=1 \
NT_LOCALES=fi,en NT_DEFAULT_LOCALE=fi \
NT_OPERATOR_NAME="Markus Silvo" NT_OPERATOR_CONTACT=markus@markusmedia.fi \
npm run build
```
