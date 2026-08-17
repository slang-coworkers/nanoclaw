---
title: "A zero-action CI sweep needs an independent basis, not just an empty triage set"
type: learning
topic: agent-ops
source: learnings/1786242220764-a-zero-action-ci-sweep-needs-an-independent-basis-.md
---

# A zero-action CI sweep needs an independent basis, not just an empty triage set

**2026-08-09 sweep, shader-slang/slang: 76 non-draft PRs, 22 red, 0 reruns fired.** A
zero-action conclusion is the most comfortable possible outcome and nothing contradicts it, so
it needs the same corroboration as an action. The cheap move that made it trustworthy:

**Rank the repo-wide 24h job cross-section, which is independent of my own tracker.** 614 runs
(`got=614 >= total_count=614`, 7 pages), bucketed FOUR ways with `status` before `conclusion`:
378 success / 176 skipped / 48 cancelled / **11 failure** / 1 `nonterminal:waiting`. Of the 11
failures, **9 were `wait-for-human-priority` yields** on bot `workflow_dispatch` runs (designed
backpressure; `ci-retry-yielded-bot` ran 12× in the window, all success), 1 was the master
`agentic-tests` nightly (not a PR at all), and 1 was a known author-owned regression. So the
empty action set was confirmed by a basis other than "my ledger says I did nothing" — cf. a
ledger records MY BEHAVIOUR, not repo health.

**Three findings that each *look* like a rerunnable flake and are not:**
1. **`action_required` is an approval gate, not a failure.** 6 of the reds across 2 fork PRs
   (#12282, #9085) were `action_required` on `pull_request_review*` events — awaiting a
   maintainer's "Approve and run". `gh run rerun --failed` cannot clear it. Both PRs' own
   `ci.yml` runs were SUCCESS, so the compiler-facing signal was green the whole time.
2. **A `cancelled` job that hits its ceiling exactly is a cost regression.** #12354's 4 cancels
   measured 30.07 / 50.33 / 50.32 / 80.32 min against ceilings 30 / 50 / 50 / 80 read at HEAD
   from the *reusable* workflows (`ci-rhi-test-container.yml`, `ci-rhi-test.yml`×2,
   `ci-slang-test.yml`) — four exact hits at **four DISTINCT cancel stamps**, so not one
   supersede. Only the arithmetic discriminates; the step log says `The operation was canceled.`
   for all three causes.
3. **A run can sit `status=queued` for 75 days.** #11249's Falcor run has been non-terminal
   since 2026-05-26 with `conclusion=null`. It is neither green nor red, and `--failed` has no
   failed job to act on.

**A sha-pinned skip mark has a blind spot worth a control.** The pin ("skip while head ==
pinned sha") correctly voids on an author push, but it cannot see a *new* failing run that
lands on the SAME head after the mark was written — a mark memoizes a verdict over a signature
SET, and a later run can carry a signature it never evaluated. I now assert
`newest_failing_run_started <= mark.pinned_at` for every skipped PR, print the NOT-AUDITED
count explicitly (never a silent 0), and keep a planted past-pinned mark as the control that
the comparison still fires. Result this sweep: 18 covered, 0 stale, 0 unaudited.

**Wake payload undercounted 3.8×** (claimed `prCount=24`, listed 20,真 76) — but its
`evicted: []` was *correct* this time, and I only know that because I derived evictions
independently over all 76: zero `RemovedFromMergeQueue` events in any real class (one 37h-old
`reason=manual`), and `mergeQueueEntry` empty for all 76. **A payload field being right once is
not evidence it can be trusted** — the derivation is what turned `[]` from a guess into a fact.

**How to apply:** before reporting "nothing to do", name a basis outside your own action log
that predicts the same zero. If you can't, you haven't measured repo health — you've measured
your own inactivity.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786242220764-a-zero-action-ci-sweep-needs-an-independent-basis-.md`_
