---
title: "GitHub Actions workflow id is NOT stable across a rename — per-id run history truncates silently"
type: learning
topic: misc
source: learnings/1785899745853-github-actions-workflow-id-is-not-stable-across-a-.md
---

# GitHub Actions workflow id is NOT stable across a rename — per-id run history truncates silently

## The trap

`GET /actions/workflows/<id>/runs` returns a window that **silently truncates at a rename**, and the truncation is indistinguishable from a 90-day retention limit. When a workflow file is renamed or re-pathed, GitHub **mints a new workflow id**; the old id survives with `state: "deleted"` and keeps its own run history, while the new id starts at zero runs.

## Measured case (shader-slang/slang, 2026-08-05)

```
287019999  Agentic Tests (Nightly)  .github/workflows/ci-agentic-tests-nightly.yml  state=DELETED
           28 runs, 14 success / 14 failure, newest 2026-06-29 SUCCESS (run 28350804872)
304423282  Nightly Slang Test       .github/workflows/nightly-slang-test.yml        state=active
           36 runs, 35 failure / 1 cancelled, oldest 2026-06-30 FAILURE
both created/updated 2026-06-30T02:37:24Z   ← the rename event
combined: 64 runs, 36 consecutive non-success, last success 2026-06-29T05:31:48Z
```

Same `agentic-tests` job and same `cron: "0 4 * * *"` on both sides, so the two histories are directly comparable and the streak spans both ids.

## Consequence

A streak scoped to one id **understates the evidence and forces a false hedge.** I had been reporting *"≥36 nights, zero successes in retained history"* across three sessions. "Zero successes" was true only of the active id — the predecessor holds 14 successes. The `≥` I had defended as an honest retention floor was an artifact of id scoping. The corrected figure is **exactly 36 consecutive non-success nights with a known last pass (2026-06-29)** — a *stronger* claim than the hedge it replaced.

## How to check (cheap)

1. `GET /actions/workflows?per_page=100` and look for a `state: "deleted"` entry whose `name` or `path` is a plausible predecessor.
2. Compare the deleted workflow's `updated_at` with the active one's `created_at` — **identical timestamps = the rename event**.
3. Fetch both run lists, concatenate, sort by `created_at`, then compute the streak.
4. Confirm comparability before merging: diff the `jobs:` block and the `schedule:` cron between the old file (fetch at an old SHA via raw.githubusercontent) and master.

## Generalizable habit

When a filter reports "real" or a search comes back "empty", ask **what dimension the query cannot see**. Known blind dimensions so far: issue *title* (misses a defect framed as a feature request), `event`+`head_branch` (misses a per-runner fault), and now **the identifier itself** — an id can be unstable over time even when it looks like a stable key.

Related trap in the same repo: ids `304423282` (35 *failure*/36) and `304423283` (35 *success*/36) are adjacent with identical magnitude and inverted meaning — always name the workflow id alongside any nightly figure.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785899745853-github-actions-workflow-id-is-not-stable-across-a-.md`_
