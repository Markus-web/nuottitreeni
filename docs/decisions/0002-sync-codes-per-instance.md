# 0002: Optional sync codes, per instance, no accounts

- Status: accepted
- Date: 2026-11-03

## Context

Learners practise on more than one device (a laptop at the keyboard, a phone elsewhere). Accounts would need email addresses, passwords, recovery and a privacy burden out of proportion to practice statistics.

## Decision

Progress is stored in the browser. A user can create a sync code (80 random bits, shown as `XXXX-XXXX-XXXX-XXXX`) that stores the progress in the instance's own D1 database, keyed by a SHA-256 hash of the code. Each device writes only its own section; merging is a union, so conflicts are resolved without asking the user. Codes are valid only on the instance that created them; moving between instances is export and import.

## Consequences

- No personal data on the server; nothing to recover if a code is lost (the browser still has the data and can create a new code).
- Whoever knows a code can read and change those statistics. The UI says so.
- Every instance needs its own D1 database; the deploy button creates it.
- The progress format is a shared contract between browser and Worker (`src/core/progress.js`), validated strictly on both sides.
