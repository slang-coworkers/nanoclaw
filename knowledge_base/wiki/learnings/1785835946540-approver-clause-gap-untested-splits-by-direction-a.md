---
title: "[approver/clause-gap] 'Untested' splits by DIRECTION — an untested benefit with a proven-safe harm direction is not the same risk as an untested harm direction"
type: learning
topic: review-approval
source: learnings/1785835946540-approver-clause-gap-untested-splits-by-direction-a.md
---

# [approver/clause-gap] "Untested" splits by DIRECTION — an untested benefit with a proven-safe harm direction is not the same risk as an untested harm direction

# Name which direction is untested before scoring the gap

**Context:** shader-slang/slang#12322 @`ba156ebf5c900ff89189c15347bafded7b4280ee`
(slang-test gates `-emit-cpu-via-llvm` on LLVM backend availability), decided
WOULD_APPROVE 2026-08-04.

## Symptom

A true, verifiable statement about this PR: **no CI leg exercises the code path
the fix exists to fix.** The fix makes LLVM-requiring tests report `Ignored`
instead of `Failed` on a runner lacking `slang-llvm` — and no CI leg lacks
`slang-llvm`. Independently confirmed twice:

- every matrix entry that disables LLVM (`ci-slang-build.yml:173,220-228`;
  `cmake-options-build.yml:96,142,172,181`; `nightly-mdl-perf-test.yml:101`;
  `regenerate-cmdline-ref.yml:49`) is **build-only — no slang-test step**;
  `build-llvm` defaults `true` with no `ci.yml` caller overriding it;
- job logs at the pinned head: all 11 legs running slang-test list `llvm` in
  their `Supported backends:` line.

The primary review bot itself raised this as a 🟡 on an earlier revision. Read
plainly — "the shipped behavior is not covered by any test" — that is a textbook
`ABSTAIN_POLICY:OPEN_GAP`.

## Root cause of the scoring error

"Untested" was doing double duty for two different risks. Split them:

- **Harm direction** (over-gate ⇒ a test that *should* run is silently skipped ⇒
  coverage loss that reads as green): **empirically refuted.** Exact-match
  `ignored test:` count for the 4 affected files across all 11 logs = **0**, with
  a must-be-non-zero control (`grep -c "ignored test:"` = 119–7613 per log).
  Also refuted structurally: the write is monotone (pure OR, one reader,
  no clear site), so it can never turn a pass into a fail.
- **Benefit direction** (absent ⇒ `Ignored` instead of `Failed`): untested in CI,
  resting on the author's local verification (hiding `libslang-llvm`).

The worst case of an untested *benefit* is that today's bug simply stays
unfixed — **no regression, zero blast radius on any current leg.** That does not
meet the conservative-lean bar ("plausible real trigger, real blast radius, or a
gap that undermines the PR's stated purpose"): there is no trigger on any leg,
and the PR's stated purpose is unaffected on every leg that exists today.

## How to catch it

When a gap is phrased as "X is not tested", ask **which direction of X**:

1. What does the change do if it is WRONG (harm)? Is that direction tested,
   refuted structurally, or unknown?
2. What does it do if it is RIGHT but the mechanism never fires (benefit)? Is
   *that* what's untested?

Only case 1 being unknown meets the OPEN_GAP bar. Case 2 alone is an advisory
note. Stating which direction is untested is the step that dissolves the
ambiguity — the ambiguity is in the phrasing, not in the evidence.

## The counterexample that keeps this honest

This is NOT a licence to clear untested changes. In slang-rhi#802 (Metal bindless
`DescriptorHandle`) the untested direction WAS the harm direction, the
implementation was **source-verified correct**, and the held-on tests later
EXECUTED and FAILED — the abstain was vindicated. The discriminator between #802
and #12322 is not "how confident did the code look" (both looked fine) but
**which direction lacked evidence.**

## Fix

Record the two directions separately in the challenger, each with its evidence
class (empirical / structural / none). Score the gap on the harm direction. If
you cannot say which direction is untested, you have not finished the analysis —
and uncertainty still means ABSTAIN.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785835946540-approver-clause-gap-untested-splits-by-direction-a.md`_
