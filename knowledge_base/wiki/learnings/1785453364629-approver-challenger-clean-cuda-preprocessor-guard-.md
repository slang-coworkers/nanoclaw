---
title: "[approver/challenger-clean] CUDA preprocessor-guard on a shared Slang test module — verify skip-before-load ordering"
type: learning
topic: review-approval
source: learnings/1785453364629-approver-challenger-clean-cuda-preprocessor-guard-.md
---

# [approver/challenger-clean] CUDA preprocessor-guard on a shared Slang test module — verify skip-before-load ordering

## Class
A PR wraps ONE `[shader]` entry point in a shared multi-entry-point Slang
module (e.g. `slangpy/tests/device/test_buffer.slang`) in
`#ifndef __TARGET_CUDA__ ... #endif` to keep the module loadable on CUDA for
its sibling entry points. Rationale: Slang capability-checks **all** entry
points in a module at load time, so one unsupported entry point (typed
`Buffer<T>`/`RWBuffer<T>` on CUDA, E36107 under shader-slang/slang#12289) takes
the whole module — and its CUDA-clean siblings — down. This is a
**false-negative-safe-by-construction** change.

## The two probes that make WOULD_APPROVE airtight (don't approve on the diff alone)
1. **Structural containment:** confirm the `#ifndef`/`#endif` wraps ONLY the
   target entry point — open before it, close before the next `[shader]` /
   section — so no sibling is accidentally stripped. Read the full file at the
   pinned head, not just the hunk.
2. **Skip-before-load ordering (the load-bearing one):** the PR will claim "no
   coverage loss because the guarded variant is already `pytest.skip`-ed on
   CUDA." VERIFY that the skip fires **before** the
   `load_program(..., ["copy_" + type])` (or equivalent entry-point request).
   If the skip were *after* the load, stripping the entry point would turn a
   clean skip into an "entry point not found" error on CUDA — a regression, not
   a no-op. In PR #1083 the skip (`test_buffer.py:76-77`) precedes the
   `load_program` at L118-120, so the guarded entry point is never requested on
   CUDA → zero exercised coverage removed.

## Also confirm
- The macro name is real in-repo precedent (`#ifndef __TARGET_CUDA__` is used in
  `src/sgl/device/blit.slang:61-86`), not invented.
- Non-guarded backends: `__TARGET_CUDA__` undefined → entry point stays present
  → compiles as before. No behavioral change.

## Outcome
PR #1083 @ 25004c5814a2 → WOULD_APPROVE (Devin-only tier; production
claude-pr-review skips `nv-slang-bot[bot]` fixer branches, so harvest exits 20
and Devin is the sole signal — clean). Confirmed safe for the reasons above.
See [[review-approver-challenger-calibration]] §"gap CLEARS" and the CUDA
prelude-typedef learning for the sibling pattern.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785453364629-approver-challenger-clean-cuda-preprocessor-guard-.md`_
