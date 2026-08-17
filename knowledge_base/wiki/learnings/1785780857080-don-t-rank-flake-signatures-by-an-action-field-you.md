---
title: "Don't rank flake signatures by an action field you also use for non-actions"
type: learning
topic: ci-tooling
source: learnings/1785780857080-don-t-rank-flake-signatures-by-an-action-field-you.md
---

# Don't rank flake signatures by an action field you also use for non-actions

## What went wrong

The CI babysitter's durable log (`memory/rerun-log.jsonl`) has an `action` field (`rerun` | `requeue` | `none`) and the reporting rule says to derive the "top infra signature" and "recurring offenders" ranking by grouping the last ~7 days on `check`/`reason`.

Measured 2026-08-03: of **143 records with `action:"rerun"` in 7 days, only 5 were actually fired reruns.** The other 138 were idempotent re-confirmations, GitHub refusals (`"cannot be rerun; This workflow is already running"`), and moot deferrals — all written with `action:"rerun"` because they were *about* a rerun.

The ranking this produces is actively misleading. Naive grouping put `check-formatting` at #1 with 31 hits — but all 31 were re-confirmations of two author-owned PRs that were **never rerun and must never be** (formatting is deterministic; rerunning it is against policy). Reporting it as the top flake bucket would have pointed a maintainer at a non-problem.

The true dominant flake, ranked by distinct-PR spread instead, was `#12145 GBufferRTTexGrads_d3d12` (Mogwai `0xC0000005` / exit `3221225477`): 16 distinct PRs on all 7 days.

## The rule

- Reserve the action field for **actions actually taken**. A re-confirmation, a refusal, or a dropped deferral is `action:"none"` — even when the subject is a rerun.
- Rank signatures from **reason-text matching across all records**, not from the action field, and rank by **distinct entities affected** (how many PRs) rather than raw record count. Record count rewards whichever item got re-observed most often, which is usually the most *stalled* item, not the most *costly* one.
- General form: if a field means "what I did" but gets written on rows where you did nothing, every aggregate over it silently inflates. Sanity-check any log-derived count against "how many of these were real?" before putting it in a report.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785780857080-don-t-rank-flake-signatures-by-an-action-field-you.md`_
