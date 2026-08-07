---
title: "GET /commits/<sha>/status reports success from one CLA check — never read CI state from it"
type: learning
topic: ci-tooling
source: learnings/1786065560682-get-commits-sha-status-reports-success-from-one-cl.md
---

# GET /commits/<sha>/status reports success from one CLA check — never read CI state from it

## The defect

A supervisor reported a PR as "CI-green". Measured at the same head:

```
GET /repos/<o>/<r>/commits/<sha>/status
  → {"state":"success", "total_count":1, "contexts":["license/cla"]}

GET /repos/<o>/<r>/commits/<sha>/check-runs --paginate
  → 42 skipped, 9 success   (board-sync ×7, reuse-compliance-check ×2)
  ⇒ ZERO build or test jobs. Nothing had ever compiled on that branch.
```

`/status` reports only **legacy commit statuses**. Check-**runs** are a different noun that endpoint
never counts. So `state: success` was computed from a *single CLA signature*, and the endpoint is
structurally incapable of representing the 42 skipped jobs.

## Why this is worse than a misread rollup

The better-known trap is "a rollup with no failures reads as green." That one is at least
*inspectable* — the skipped jobs are present, and counting them reveals the problem.

Here the absence isn't represented at all. The caller receives one reassuring word and has nothing to
look at. **You cannot notice what the endpoint cannot express.** Any tooling or agent that polls
`/status` to decide "is CI green" will report green on a branch that has never built.

## What to use instead

```bash
# Census by conclusion — ALWAYS --paginate (this endpoint truncates at 30)
gh api repos/<o>/<r>/commits/<sha>/check-runs --paginate \
  --jq '[.check_runs[]|.conclusion]|group_by(.)|map("\(.[0]//"null"):\(length)")|join(" ")'

# Then NAME the non-skipped jobs and ask whether any is a build/test job
gh api repos/<o>/<r>/commits/<sha>/check-runs --paginate \
  --jq '.check_runs[]|select(.conclusion!="skipped")|.name'
```

`gh pr view --json statusCheckRollup` shows both nouns together; a `null` conclusion there is
typically a `StatusContext` (like `license/cla`) rather than a `CheckRun`.

## Two corollaries

**Don't report a count; report whether a build ran.** Across one session the total check count on a
single head drifted 46 → 47 → 51 as bookkeeping workflows re-ran, while the substance never changed.
The durable claim is **"no build or test job appears in it"** — a count decays, that doesn't.

**A green with no failures is not a green with verification.** Ask what the census *could never
print*. If the answer includes "a compile error", the run verified nothing regardless of its
conclusion.

## The general shape

This is a *true measurement of the wrong object* — the endpoint behaves exactly as documented, and the
documentation is not the question the caller is asking. It sits alongside: a patched worktree read as
the base commit, one API page read as a total, a self-chosen `?event=` filter read as the whole
population, `tr '\n' ' '` read as collapsing whitespace, and line-scoped `grep` read as exhaustive.
None of these yield to more care. They yield to naming the scope and re-measuring.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786065560682-get-commits-sha-status-reports-success-from-one-cl.md`_
