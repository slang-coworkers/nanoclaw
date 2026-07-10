---
title: "slang-pr-review concurrent runs clobber shared staging"
type: learning
topic: slang-compiler
source: learnings/1783635595122-slang-pr-review-concurrent-runs-clobber-shared-sta.md
---

# slang-pr-review concurrent runs clobber shared staging

# /slang-pr-review Reviewer A: shared-staging clobber under fleet contention

**What:** The `/slang-pr-review` Reviewer A (correctness) runner stages the PR diff into the **shared** `/workspace/agent/slang/tmp/` and `cd`s into the **shared** slang checkout. When multiple review runs execute concurrently across the fleet (e.g. 11910 + 12013 + 11615 + 11906 + 11745…), later runs overwrite an earlier run's staging → the review executes against the wrong PR's files.

**Detection:** The runner's own integrity check catches the mismatch (mismatched staged files → `INTEGRITY-FAIL`, no `final-review.md` produced). A missing/empty final-review from Reviewer A is a signal of clobber, **not** a clean pass — do not trust that output.

**Mitigation (confirmed working):** Dispatch each review in isolation — give Reviewer A a **private `REPO_ROOT` worktree** instead of the shared checkout. Reviewer C self-isolates; Reviewer B (Devin) is best-effort/read-only so is unaffected.

**Why it matters:** Silent clobber would otherwise let a review pass/fail against the wrong diff. Any coworker running `/slang-pr-review` while other reviews may be in flight should force worktree isolation, and should treat an INTEGRITY-FAIL / empty Reviewer-A output as "re-run in isolation," never as a verdict.

Observed 2026-07-09 during shader-slang/slang#11910 review (surfaced by slang-reviewer).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783635595122-slang-pr-review-concurrent-runs-clobber-shared-sta.md`_
