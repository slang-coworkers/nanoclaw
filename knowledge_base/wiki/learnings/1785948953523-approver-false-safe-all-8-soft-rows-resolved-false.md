---
title: "[approver/false-safe] All 8 soft rows resolved — false-negative set is 8 of 28 abstains (29%), every one from the same board-sync onboarding change class, and every flag was advisory-by-design with a compensating control in the callee or a nightly sweep"
type: learning
topic: review-approval
source: learnings/1785948953523-approver-false-safe-all-8-soft-rows-resolved-false.md
---

# [approver/false-safe] All 8 soft rows resolved — false-negative set is 8 of 28 abstains (29%), every one from the same board-sync onboarding change class, and every flag was advisory-by-design with a compensating control in the callee or a nightly sweep

# [approver/false-safe] The soft queue emptied to zero real gaps — and the 29% rate is the finding

## Result

Worked the remaining five soft rows (after `#1084`×3). **All eight resolve to
`WOULD_APPROVE`**, so the false-negative set from the ABSTAIN-vs-merged join is now **8 of
28 joined abstains — 29%.**

| row | policy | failed clause | Step 2 | resolution |
|---|---|---|---|---|
| `#1084` ×3 | v0-shadow | `no_protected_paths` | APPROVE_WITH_NITS, 2-4 gaps | flags all nits; one **inverted** |
| `#1002` @49b57f66b242 | v0-shadow-relaxed | `no_protected_paths` | APPROVE, **0 gaps** | nothing to judge |
| `#1078` @06e7ddad232a | v0-shadow | `author_trust` | APPROVE_WITH_NITS, 2 gaps | masked D3D12 fault ⇒ genuine `OPEN_GAP` (only non-approve) |
| `samples#57` @7faf66b86e64 | v0-shadow-relaxed | `no_protected_paths` | APPROVE, **0 gaps** | nothing to judge |
| `samples#57` @b20c12ef7131 | v0-shadow-relaxed | `no_protected_paths` | APPROVE_WITH_NITS, 2 gaps | both advisory (below) |
| `samples#57` @df17e0f266ef | v0-shadow-relaxed | `no_protected_paths` | APPROVE_WITH_NITS, 3 gaps | same class |

**Every row is the same change class:** onboarding a repo to `shader-slang/slang`'s reusable
`pr-board-sync.yml` — thin caller workflows under `.github/workflows/`, delegating to a
callee at `@master`. `#1084` is slangpy's onboarding, `samples#57` is slangpy-samples'. So
`no_protected_paths` firing on `.github/**` under the pre-widening policy hit the *same
project* repeatedly, which is exactly the concentration the `v0-shadow-wide` widening cites
(*"32 cases, all CI workflow / .github docs"*).

## Every flag had a compensating control, in a place the diff doesn't show

Two distinct patterns, both requiring a read outside the caller diff:

**1. Callee documents the pattern.** `permissions: {}` was flagged on both PRs as *"empty
permissions rely on the reusable workflow using the PAT only."* The callee
(`shader-slang/slang/.github/workflows/pr-board-sync.yml:48-57`) states *"callers should set
`permissions: {}` because this workflow uses the PAT for everything, not the GITHUB_TOKEN"*
and sets it itself at `:177`. **Acting on the flag grants privilege the design withholds.**

**2. A different file in the same PR is the mitigation.** `samples#57`'s flag *"assignment-
related PR events are not among the declared triggers"* is **factually correct** —
`pull_request_target` types are `[opened, reopened, edited, synchronize, closed,
ready_for_review, converted_to_draft, enqueued, dequeued]`, no `assigned`/`unassigned`, and
the callee *does* act on assignment (`pr-assign.test.js`, assignee fallbacks). But the same
PR adds `pr-sweep-nightly.yml` (`cron: "0 7 * * *"` → same callee), which resyncs the board
nightly. So assignment drift is bounded by ≤24h rather than unhandled — a **deliberate
latency tradeoff**, and the sibling `#1084` made the identical choice.

⇒ Generalizes the earlier caller/callee rule one step: **severity can require reading the
callee *or* a sibling file in the same PR.** A per-file review sees the trigger list without
the sweep; a caller-only review sees the empty permissions without the contract. Both
one-sided views manufacture concerns.

## Why 29% matters more than any single row

A false-negative rate of 8/28 in the joined set — with the *only* genuine abstain being
`#1078`'s masked D3D12 device-removal — says the pre-widening `no_protected_paths` predicate
was not slightly conservative but **dominant**: on this change class it fired essentially
always, and essentially always wrongly. That is quantified support for the human-signed
widening, measured after the fact from outcomes rather than from the abstain rate alone.

Caveat kept: this measures *my* 57 workspaces, all pre-08-05, heavily weighted toward a few
multi-head PRs (`#1075`×9, `samples#53`×7). It is a rate over decisions, not over
independent PRs — 28 abstains span ~10 distinct PRs. **Don't quote 29% as a per-PR rate.**

## Writes still held

Nothing stamped or re-recorded. The ledger question is open pending one operator grep, and
`head_advanced` means a backfill must be driven from ledger-held shas, never my
workspace-derived list. Findings recorded; state unchanged.

Siblings: the ABSTAIN-vs-merged join entry; the `#1084` caller/callee entry; the
staging-fallback entry.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785948953523-approver-false-safe-all-8-soft-rows-resolved-false.md`_
