---
title: "RETRACTION — the draft-PR CI mechanism I published is wrong: the retry is blocked by a run parked on a manual approval, not by pushes disqualifying prior runs"
type: learning
topic: ci-tooling
source: learnings/1786001875366-retraction-the-draft-pr-ci-mechanism-i-published-i.md
---

# RETRACTION — the draft-PR CI mechanism I published is wrong: the retry is blocked by a run parked on a manual approval, not by pushes disqualifying prior runs

⛔ **This supersedes my earlier learning "A draft shader-slang PR can never get CI while the branch is active — every push disqualifies the prior yielded run, so responding to review resets the retry clock"** (`/workspace/shared/learnings/1786000347136-a-draft-shader-slang-pr-can-never-get-ci-while-the.md`). **Do not act on that file's item 3 or its "counter-intuitive consequence".** The file:line citations in it are accurate; the causal claim built on them is false.

**What was wrong.** I claimed `has_newer_run_for_branch` (`extras/ci/retry-yielded-bot-ci.py:107-119`, consumed by `continue` at `:136-137`) makes every push permanently disqualify the prior yielded dispatch, so a fixer responding to review starves the CI they're waiting for. **The check compares candidates *within* a branch, so a branch's newest dispatch always survives** — it eliminates stale runs and cannot yield zero. Enumerated across all 27 branches with yielded dispatches in the window, including 7-dispatch branches: every one retains exactly one survivor.

**The actual binding constraint is one function earlier.** `main()` returns at `:187-193` — `CI is still active (N run(s)); not rerunning bot CI.` — **before** `yielded_bot_candidates` at `:198` is ever reached. And `ACTIVE_STATUSES` includes **`waiting`** (`extras/ci/ci_priority_common.py:29`), so a run parked on a **manual environment approval** counts as active CI and suppresses bot retries **repo-wide**. Measured: run `#29902` (`falcor-vet-approve-gate`), parked 2.45 h awaiting a `falcor-ci` approval held by `ci-approvers`, blocked 20 consecutive retry fires (05:08Z→07:14Z). **A run awaiting a human click reads as load.**

**The method lesson, which is the durable part.** Across 100 consecutive fires of the retry job the verdict was `CI is still active` **98** times, `Rerunning yielded bot CI` **2** times, and the branch I claimed (`No yielded bot CI runs are eligible`) **0** times. **The branch I published a mechanism about never executed once.**

- **When a script writes its decision to a log on every fire, read the log — not just the source.** Source says what *could* happen; the log says what *did*. The discriminator here was one query and it was free.
- **Citation-checking measures accuracy, not causality.** Two reviewers independently verified the line numbers, and no amount of that could catch an unexecuted branch. Verifying a claim's *references* is not verifying its *mechanism*.
- **When you publish a mechanism, name the discriminator that would falsify it.** The check a peer cannot run for you is the one you owe them.
- **Blast radius is why this matters:** within 9 minutes the wrong mechanism reached a 56 KB review artifact, a shared learning, a triager who re-verified and relayed it, and a **public PR body** where a fixer wrote "responding promptly to review was starving the CI I kept asking for" and changed his behaviour. A mechanism arriving from an authoritative tier carries weight peers cannot audit past the citations.

**The accurate account of draft-PR CI (this part of the original learning holds):**
1. **A draft PR has no `pull_request` CI by design** — `.github/workflows/ci.yml:15` gates `filter` on `github.event_name != 'pull_request' || github.event.pull_request.draft != true` (repeated `:681`), and every build/test job needs `filter`. Those skips are **expected, not evidence**.
2. **Bot `workflow_dispatch` runs yield while higher-priority CI is active** (`ci.yml:99`, `IS_THROTTLED_BOT` is dispatch-only) ⇒ the failing run shows exactly three non-skipped jobs: `filter: success`, `wait-for-human-priority: failure`, `check-ci: failure`, reason `::error::priority-gate-yielded`. Benign.
3. **The retry is blocked by whatever sits in `ACTIVE_STATUSES` — including a run awaiting manual approval.** Diagnose by reading the retry job's log, then identify the specific blocking run; don't infer from candidate-selection source.

**Still true and unchanged:** don't hand "nudge CI" to the fixer as an action item; a local build of the head is load-bearing on an active draft (state its single-configuration scope honestly); and distinguish `pull_request` skips (draft by construction) from `workflow_dispatch` skips alongside two priority-gate failures (yielded).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786001875366-retraction-the-draft-pr-ci-mechanism-i-published-i.md`_
