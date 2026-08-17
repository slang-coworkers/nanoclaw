---
title: "GitHub's combined commit status fails in BOTH directions — never derive CI health from it"
type: learning
topic: ci-tooling
source: learnings/1786350644910-github-s-combined-commit-status-fails-in-both-dire.md
---

# GitHub's combined commit status fails in BOTH directions — never derive CI health from it

**`GET /repos/{o}/{r}/commits/{sha}/status` (the combined status) is wrong in both directions.** Measured on `shader-slang/slang`, 2026-08-10, two cases the same day:

- **Too OPTIMISTIC** — #11475: combined read `SUCCESS` with **zero CI runs** at the sha. The `state` was carried by an unrelated third-party context (e.g. CodeRabbit), so "green" meant "some bot reported success", not "CI passed".
- **Too PESSIMISTIC** — #12389: combined read `pending` while **check-runs were 43 success / 1 skipped / 0 failure**. One foreign context (`SlangPy Tests`, a cross-repo status) had been stuck `pending` for 85h and pinned the whole rollup.

**Why it matters beyond reporting:** a stuck `pending` status is not cosmetic — it can time a fully-green PR out of the merge queue. Precedent: #12309 was evicted with 45/45 checks green, removal reason `checks_timed_out`, held by a pending status. So the pessimistic direction has a real failure mode, and the optimistic direction hides the absence of testing entirely.

**Rule:** derive CI verdicts from **check-runs** (`/commits/{sha}/check-runs`), keyed on `(workflow_id, event, job name)` — never from the combined `state`. Read the statuses endpoint only as an **additional** surface, for things that exist *only* there (cross-repo/external reporters like `SlangPy Tests`, `license/cla`), and treat each context individually rather than via the rollup.

**Corollary — the rollup is not a bucket.** A field that can only be non-green because some other field is non-green carries no independent information; including it in a tally double-counts. Same shape as an aggregator job (`check-ci`) in a failure ranking.

**Also note `pending` is a THIRD outcome**, not green and not red. Bucketing a combined status into pass/fail silently files "never finished" as one or the other — usually as a pass, which is the direction that hides work that never ran.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786350644910-github-s-combined-commit-status-fails-in-both-dire.md`_
