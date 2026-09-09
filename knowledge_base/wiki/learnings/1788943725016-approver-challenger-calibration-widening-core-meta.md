---
title: "[approver/challenger-calibration] Widening core.meta.slang overload + identity constant-fold merged unchanged (slang#12651) — direction is what makes core-module edits a false-safe risk"
type: learning
topic: review-approval
source: learnings/1788943725016-approver-challenger-calibration-widening-core-meta.md
---

# [approver/challenger-calibration] Widening core.meta.slang overload + identity constant-fold merged unchanged (slang#12651) — direction is what makes core-module edits a false-safe risk

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788936262088-ux4t63
written_at: 2026-09-09T08:48:45.016Z
---

# [approver/challenger-calibration] Widening core.meta.slang overload + identity constant-fold merged unchanged (slang#12651) — direction is what makes core-module edits a false-safe risk

## Symptom
slang#12651 ("Fold unary + in constant expressions", MEMBER natevm, fork head) added `operator+` beside `operator-` in `source/slang/core.meta.slang` and folded unary `+` in `tryConstantFoldExpr` (`source/slang/slang-check-expr.cpp`). The approver recorded `ABSTAIN_POLICY (CLAUSE_FAIL:head_provenance)` (empty policy mount, bundled v0-shadow forbids fork heads) and early-returned — the challenger never ran, so the core-module edit was never examined on merits. Step-0 recall bullet (#12141) flags ANY `core.meta.slang`/`hlsl.meta.slang`/prelude edit as a downstream-breakage / false-safe class, which would push a challenger toward caution here.

## Root cause / the distinction that matters
#12141's false-safe was a **narrowing** change — disabling core-module overloads via `static_assert`, which broke bundled `external/slang-rhi` shaders that *only* the `test-slang-rhi` check-runs compile (green `test-slang` + byte-identical drift missed it). #12651 is the **opposite direction**: a purely **additive** overload (new symbol `operator+`; existing overload resolution unchanged, nothing removed/constrained) plus an **identity fold** (unary `+` returns its operand unchanged — none of the un-truncated-64-bit / source-width / ParenExpr-peel / two's-complement concerns that unary `-`/`~` folding carries per the IntegerLiteralExpr recall bullet).

## Outcome (calibration evidence)
MERGED by jkwak-work at `b86a8a38e209f18b2d4009720af5cb8a56910b29` — the approver's **exact decision commit, zero follow-up commits** → shipped unchanged. The low-risk hypothesis recorded in the decision row is validated: the widening core-module addition triggered no downstream (slang-rhi or otherwise) breakage.

## How to catch it / transferable rule
Before treating a `core.meta.slang`/`hlsl.meta.slang`/prelude edit as the #12141 false-safe class, **classify the change direction first** — the same widening-vs-new-gate logic the approver already applies to lowering-pass flags:
- **Narrowing / removing / constraining** what compiles (disable an overload, tighten a `static_assert`, drop an atom) → real #12141 risk: harvest **check-runs at head** (must include `test-slang-rhi`), treat downstream breakage as BLOCK-class even under an APPROVE-with-nits verdict.
- **Purely additive / widening** (a NEW overload, a NEW capability atom, a flag broadened false→true) → NOT the #12141 risk class; a new symbol cannot break callers that never referenced it. The only residual probes are overload-ambiguity (does the new overload collide with an existing one on some argument set?) — not downstream shader breakage.

Separately, for constant-fold ops: split **identity** ops (unary `+`) from **value-changing** ops (unary `-`, `~`, binary arithmetic). Only the value-changing ones need the source-type-width / no-intermediate-wrap / ParenExpr-peel probe; an identity fold is safe by construction.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788943725016-approver-challenger-calibration-widening-core-meta.md`_
