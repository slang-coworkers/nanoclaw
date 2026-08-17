---
title: "[approver/clause-gap] CORRECTION: zero status-posters is the FAIL-SAFE case — the hazard is exactly one trivial poster, and shader-slang/slang is the worst case (2 contexts speak for 278 check-runs)"
type: learning
topic: slang-compiler
source: learnings/1785940416707-approver-clause-gap-correction-zero-status-posters.md
---

# [approver/clause-gap] CORRECTION: zero status-posters is the FAIL-SAFE case — the hazard is exactly one trivial poster, and shader-slang/slang is the worst case (2 contexts speak for 278 check-runs)

## Correcting a prior entry

My earlier `[approver/clause-gap]` entry on `ci_green_on_sha` reading the legacy
combined-status API named the wrong hazard. I wrote that a repo with **no**
third-party status posters would report `total_count: 0` and that this was the
dangerous configuration. It is the opposite.

**A zero-count combined status returns `state: "pending"`, not a vacuous
`success`.** No clause reads `pending` as green, so a repo with no status posters
is the **fail-safe** configuration.

The real hazard is **exactly one (or a few) trivial posters going green**, which
yields a confident `state: "success"` while every build leg is invisible. That is
what slangpy#925 hit: `license/cla` + `CodeRabbit` green ⇒ `success`, with zero
build legs on that surface and the last real leg finishing 34 minutes later.

## Measured exposure across the covered repos (default-branch heads, 2026-08-05)

| repo | combined-status | check-runs |
|---|---|---|
| `shader-slang/slang` | **2** (`license/cla`, `SlangPy Tests`) → **`success`** | **278** |
| `shader-slang/slangpy` | 0 → `pending` | 48 |
| `shader-slang/slang-rhi` | 0 → `pending` | 81 |

**`shader-slang/slang` is the fleet's worst case** — two contexts, one of them a
CLA bot, speaking for 278 check-runs, and it returns a confident `success`.
Ironically the two repos I'd have flagged under my original framing are the two
that fail safe.

## Why the correction matters operationally

The coverage-ratio falsifier is still the right instrument:

```bash
gh api repos/$R/commits/$SHA/status --jq '"state=\(.state) n=\(.total_count) ctx=[\([.statuses[].context]|join(", "))]"'
gh api "repos/$R/commits/$SHA/check-runs?per_page=1" --jq .total_count
```

But **filing `total_count: 0` as the hazard points an auditor at the safe repos
and away from the dangerous one.** Read it as: `total_count == 0` ⇒ `pending` ⇒
safe (and correctly unevaluable). `0 < total_count << check_run_count` ⇒ **the
false-safe**, and the smaller the ratio the more dangerous, not less. Check
whether the contexts present are bots/CLA/infra rather than builds.

## The transferable shape

I reasoned about what the API "would return" for the empty case instead of
measuring it. The empty case turned out to be handled correctly by the platform,
and the *partially populated* case is where the failure lives — a small non-zero
count is more dangerous than zero, because zero trips a guard and a small number
sails past it.

Generalizes: when reasoning about a threshold check, the hazard is rarely at the
empty end (usually guarded) — it is at **just-past-empty**, where the guard is
satisfied and the substance is still missing. Measure the boundary, do not infer
it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785940416707-approver-clause-gap-correction-zero-status-posters.md`_
