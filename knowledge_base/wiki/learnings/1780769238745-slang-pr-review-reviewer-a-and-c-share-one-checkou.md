---
title: "slang PR-review: Reviewer A and C share one checkout — parallel runs collide on git index.lock"
type: learning
topic: review-process
source: learnings/1780769238745-slang-pr-review-reviewer-a-and-c-share-one-checkou.md
---

# slang PR-review: Reviewer A and C share one checkout — parallel runs collide on git index.lock

> **↪ Refined 2026-07-13 by [[1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s]]** — current runner: Reviewer **C** self-isolates into its own worktree; it's Reviewer **A** (repro.sh, `cd $REPO_ROOT`) that needs the isolated REPO_ROOT under concurrent runs. The A+C shared-checkout race below is real; the isolation now targets A. See the newer note.

# slang PR-review: Reviewer A and C share one checkout — parallel runs collide on git index.lock

## What

`slang-pr-review-runner` (Reviewer A) and `slang-clarity-review-runner` (Reviewer C) both prepare their review by operating on the SAME local clone at `/workspace/agent/slang` (checkout/reset/`git apply` onto a temp branch). The `/slang-pr-review` workflow Step 4 says to dispatch A and C "in parallel" in the background.

When launched simultaneously they race on `/workspace/agent/slang/.git/index.lock`. The loser dies with:

```
fatal: Unable to create '/workspace/agent/slang/.git/index.lock': File exists.
```

and the runner exits **128** (git error), producing no `clarity-review.md` / `final-review.md`.

## Observed

- Round 1 (rev1): A at `patch-20260606T035609Z`, C at `...035610Z` — 1s apart, both happened to succeed (git ops didn't overlap).
- Round 2 (rev2): launched in the same Bash batch — **C lost the race, exit 128**, A won the lock and proceeded normally.

So the collision is **timing-dependent and non-deterministic** — "it worked last time" is not evidence it's safe.

## Why / How to apply

The two runners are not isolated; they share one working tree. True parallel dispatch is unsafe.

- **Preferred:** dispatch A first, wait for A to clear its git-apply/prep phase (it releases the lock once it's reviewing from the saved `tmp/pr-diff.patch`), THEN dispatch C. Or fully serialize: A completes → re-run C.
- After A finishes its git prep it moves to the inner `claude` CLI review phase, which reads from a saved diff and does NOT hold `index.lock` — but C's prep does a working-tree reset, which can disturb A if A is still reading files. Safest is to let A fully complete before running C.
- On a collision: confirm no live process holds the lock (`ls .git/index.lock`; check the other runner is past its prep), then simply re-run the loser. The lock is released automatically when the winning git process finishes; do not blind-delete it while a runner is mid-prep.

Until the runner skills are taught to use separate checkouts (or take a shared file lock), treat A and C as **sequential**, not parallel, despite the workflow wording.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1780769238745-slang-pr-review-reviewer-a-and-c-share-one-checkou.md`_
