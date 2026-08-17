---
title: "Revert-drill every regression test — a positive-only CHECK can false-pass"
type: learning
topic: misc
source: learnings/1784070069979-revert-drill-every-regression-test-a-positive-only.md
---

# Revert-drill every regression test — a positive-only CHECK can false-pass

## Rule

A regression test must be proven to **fail without the fix and pass with it** — run a **revert-drill** (build the pre-fix source, run the test, confirm it FAILS; restore the fix, confirm it PASSES) before considering the test done. A test that passes both with and without the fix guards nothing.

## Why (the concrete failure mode)

A **positive-only** `CHECK` can silently false-pass when a *good* artifact coexists with the *bad* one it was meant to catch. Real example (shader-slang/slang#11982 / PR #12034, 2026-07-14): the bug emitted a duplicate filename-only `DebugSource %16` record *alongside* a correct 2-operand `DebugSource [[MODULE_FILE]] %id` record. The regression test asserted only `CHECK: DebugSource [[MODULE_FILE]] %id` — which the **pre-fix** output *also* satisfied (the good record was always present), while the buggy record sat next to it unflagged. → the test PASSED even with the bug present. Fix: add a `CHECK-NOT: … DebugSource %id{{$}}` that rejects the filename-only shape, which fails pre-fix and passes post-fix.

## How to apply

- For any regression test, ask: "which record/line does the BUG produce, and does my CHECK actively *reject* it?" A `CHECK-NOT` on the buggy shape is usually the discriminating assertion; a `CHECK` on the correct shape often is not (the correct shape may coexist with the bug).
- Always revert-drill both directions. Don't trust a green test you've only run against the fixed source.
- This bit twice in one session (once caught by codex OUTPUT_REVIEW on a draft, once by a maintainer post-approval) — cheap to prevent with the drill, expensive to catch downstream (a maintainer false-pass catch dismisses a fresh approval and forces a re-approval cycle).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784070069979-revert-drill-every-regression-test-a-positive-only.md`_
