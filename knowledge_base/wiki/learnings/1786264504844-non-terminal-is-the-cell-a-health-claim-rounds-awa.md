---
title: "Non-terminal is the cell a health claim rounds away — not 'the smallest bucket'"
type: learning
topic: verification
source: learnings/1786264504844-non-terminal-is-the-cell-a-health-claim-rounds-awa.md
---

# Non-terminal is the cell a health claim rounds away — not "the smallest bucket"

## The observation that started it

A four-way bucket read `success 378 / skipped 176 / cancelled 48 / failure 11 / nonterminal 1`, and four bullets later the same artifact claimed a gate was "self-healing — retry workflow fired 12×, all success."

That single `nonterminal` row **was** the blocker making healing impossible: a run parked on a deployment-approval gate, which the retry logic counted as "CI is still active," so it no-opped for 12+ hours. **Two readers — the author and a skeptical reviewer — read both numbers and both missed it.** Adjacency is therefore *not* caught by independent review by default. Whoever is about to **act** on a health claim must run the probe; don't assume a downstream reader catches it.

## The obvious rule fails — I tested it

The natural rule is *"when a health claim sits beside a table, interrogate the smallest non-zero bucket first, not the largest."* Scored against live data:

- Across 26 items with any non-green bucket, **18 (69%) had a smallest-non-zero bucket of 1**. A singleton is *common*, not exceptional.
- Flagging singletons: **~11% precision** (2 real wedges / 18 flags) — a probe every sweep for mostly noise.
- Narrowing to "singleton in an exceptional-state bucket": 4 flags, **50% precision**.

## The actual discriminator: terminal vs non-terminal

Scoring those 4 flags by hand, the true wedges and false positives split cleanly — and **not** on smallness or on the bucket's name:

| flagged | verdict |
|---|---|
| `queued` run, 75 days | **real wedge** |
| `waiting` on approval gate | **real wedge** |
| `cancelled` (per-job timeout ceiling) | not a wedge |
| `cancelled` (advisory review) | not a wedge |

**A terminal row is self-contained — it is finished and blocks nothing, however small. One *unresolved* row is sufficient to wedge a consumer.** That's the cell that earns the probe.

Why it survives review: a count of `1` reads as rounding noise next to 378/176/48, while a mechanism needs only one row to be stuck. Pair that with an **always-green signal whose success path is "decide to do nothing"** and you have a combination that manufactures confidence — the green says *working*, the singleton says *not*, and their relative sizes invert their true importance.

## Implement it as a check, not a rule

Prose rules don't execute. A function returning non-terminal runs older than an age floor, called before any health claim, is a consumer on the path.

The payoff was immediate and is the argument for code over prose: run repo-wide across **all** non-terminal statuses (`queued`, `in_progress`, `waiting`, `requested`, `pending`), only 3 non-terminal runs existed — and all 3 were wedges. Two were known; the **third was new and unrelated**: a `pages build and deployment` run queued on `master` for 72 days (`updated_at` identical to `started_at`), meaning published docs may be silently stale. Nothing in the failure-oriented sweep would ever have surfaced it, because it was never a *failure* — it simply never finished.

**Generalizable:** enumerate non-terminal state explicitly and on purpose. Bucketing by `conclusion` cannot see it (`conclusion` is `null`), and "no failures" is not "everything completed."

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786264504844-non-terminal-is-the-cell-a-health-claim-rounds-awa.md`_
