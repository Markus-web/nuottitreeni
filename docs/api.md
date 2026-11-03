# Sync API

The Worker serves a small JSON API under `/api/`. It is the contract between the browser app and any instance; changes are backward compatible within a major version.

- Same origin only: requests with an `Origin` header from another site get `403 ORIGIN`. Requests without `Origin` (tools, tests) are allowed.
- Request bodies must be `application/json`, at most 64 KiB.
- Responses carry the security headers from `worker/headers.js` and `Cache-Control: no-store` (except `/api/config`).
- Errors are JSON: `{ "error": true, "code": "RATE_LIMITED", "message": "..." }`.

## Endpoints

### `GET /api/health`

`200 { "ok": true, "app": "nuottitreeni", "version": "1.0.0" }`

### `GET /api/config`

`200 { "operatorName": "", "operatorContact": "", "syncEnabled": true }`, cacheable for 5 minutes. The app uses it to fill in the operator on pages built without `NT_OPERATOR_NAME`, and to hide sync when it is turned off.

### `POST /api/sync`

Creates a sync record. Body: `{ "data": <progress v1> }`.

`201 { "code": "7K3M-QX2D-9PWR-HT5A", "rev": 1 }`

The code is shown to the user once. The server stores only `SHA-256("nuottitreeni:v1:" + normalized code)`.

### `GET /api/sync/:code`

`200 { "rev": 3, "data": <progress v1>, "updatedAt": 1762180000000 }`

### `PUT /api/sync/:code`

Body: `{ "baseRev": 3, "data": <progress v1> }`. Succeeds only if the stored revision is still `baseRev`.

`200 { "rev": 4 }`, or `409 { "error": true, "code": "REV_CONFLICT", "rev": 5, "data": <stored progress> }` when another device saved first. The client merges the returned data with its own (union per device, newer `updatedAt` wins for the same device) and tries again, at most three times.

### `DELETE /api/sync/:code`

`204`, or `404 NOT_FOUND`.

## Codes

16 characters of Crockford base32 (80 random bits), shown in groups of four: `XXXX-XXXX-XXXX-XXXX`. Input is normalized: case, spaces and hyphens are ignored, `I` and `L` read as `1`, `O` as `0`. A code works only on the instance that created it.

## Errors

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_JSON` | The body is not JSON |
| 400 | `INVALID_DATA` | The data is not valid progress v1 (unknown ids, fields or out-of-range numbers), or `baseRev` is missing |
| 400 | `BAD_CODE` | The code is not 16 base32 characters |
| 403 | `ORIGIN` | Request from another site |
| 404 | `NOT_FOUND` | No record for this code, or unknown route |
| 404 | `SYNC_DISABLED` | The instance has `SYNC_ENABLED=false` |
| 405 | `METHOD` | Wrong method; `Allow` lists the right ones |
| 409 | `REV_CONFLICT` | See `PUT` |
| 413 | `TOO_LARGE` | Body or data over 64 KiB |
| 415 | `JSON_REQUIRED` | Body not sent as `application/json` |
| 429 | `RATE_LIMITED` | Too many requests; `Retry-After` gives seconds |
| 500 | `INTERNAL`, `CODE_COLLISION` | Server error |
| 503 | `SYNC_UNAVAILABLE` | The database is not ready (migrations not applied) |

## Rate limits

Per client and action, counted under a key made from the action and the first 32 hex characters of `SHA-256(salt:ip:UTC date)`. The salt is random, created by the first migration and stored in D1, so no secret has to be configured.

| Action | Limit |
|---|---|
| Create | 10 per hour |
| Read | 120 per 10 minutes |
| Update | 60 per 10 minutes |
| Delete | 10 per hour |

## Progress v1

Defined and validated in `src/core/progress.js` (`validateProgress`), used by both sides. Version 1.1.0 added the lesson id `free` (free practice) and the mode `name`; both are additions, so older data stays valid, but an instance must run 1.1.0 or later before it accepts progress that contains them. In short: `{ "v": 1, "devices": { "<deviceId>": { "updatedAt", "lessons", "rhythm", "pieces", "practice" } } }`, with at most 8 devices, 400 practice days, known lesson, rhythm and piece ids only, and 64 KiB in total. Unknown fields are rejected.

## Retention

A daily cron trigger deletes records not read or written for 365 days, and rate-limit rows older than two days.
