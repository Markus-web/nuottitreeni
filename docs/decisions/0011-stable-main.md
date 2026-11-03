# 0011: Stable main through pull requests

- Status: accepted
- Date: 2026-11-03

## Context

Self-hosters pull `main` and copies made with the Deploy button build from it, so a broken commit on `main` reaches real instances. Until 1.1.0 the maintainer could push to `main` directly and CI ran afterwards; a red build was possible on `main` for a while.

## Decision

- Every change reaches `main` through a pull request, the maintainer's own included (branch protection with "include administrators").
- A pull request merges only when the required CI jobs pass on a branch that is up to date with `main`: `check` (tests, build, dry-run deploy, the browser suite) and the Node 22 and Node 26 jobs. Conversations must be resolved. History stays linear (squash merges); force pushes and deleting `main` are blocked.
- The maintainer's pull requests use auto-merge, so they merge on their own once CI is green. No approving review is required, because the project has one maintainer; CI is the gate.
- A flaky check is a bug: the Lighthouse step retries a page once when Lighthouse itself reports a runtime error, and prints the error.

## Consequences

- `main` only has commits that passed CI; releases are tagged on such a commit.
- A change takes as long as CI (about 10 minutes) to land.
- Dependabot pull requests follow the same rules.
