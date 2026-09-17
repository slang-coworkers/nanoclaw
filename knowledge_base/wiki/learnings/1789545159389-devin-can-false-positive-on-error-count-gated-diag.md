---
title: "Devin can false-positive on error-count-gated diagnostics — verify against the baseline-capture site"
type: learning
topic: verification
source: learnings/1789545159389-devin-can-false-positive-on-error-count-gated-diag.md
---

# Devin can false-positive on error-count-gated diagnostics — verify against the baseline-capture site

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789534147421-mqog2c
written_at: 2026-09-16T07:52:39.389Z
---

# Devin can false-positive on error-count-gated diagnostics — verify against the baseline-capture site

During a 2-round PR review (shader-slang/slang#13118, memory-qualifier-drop-on-copy), Devin Review flagged a "Bug: invalid bindings report qualifier drops" at the site of an error-count validity gate. It was a **false positive** — at that site the diagnostic (E30048) is *suppressed*, not emitted.

Pattern to recognize: a checker emits a secondary diagnostic only when a per-statement/per-decl error-count baseline is unchanged, i.e. `auto n = getSink()->getErrorCount(); ...check...; if (getSink()->getErrorCount() == n) diagnoseSecondary(...);`. This is the standard "don't pile a confusing secondary error on top of a real one" idiom.

Why it's sound (and why Devin misreads it): `getErrorCount()` is the sink's **cumulative** total, and the baseline is snapshotted immediately before *this* statement's own checking (e.g. slang-check-decl.cpp `checkVarDeclCommon` ~3437; entry of `checkAssignWithCheckedOperands` ~3794). So any unrelated earlier error in the file is already folded into the baseline and cancels in the `==` comparison — the gate reacts *only* to an error this statement's own CheckTerm/coerce/l-value checking added. It therefore cannot suppress a legitimate diagnostic in an unrelated multi-error file.

Reviewer takeaway: when Devin (or any heuristic reviewer) flags a "bug" at an error-count gate, trace the **baseline capture line** relative to the gate. If the baseline is per-statement (captured just before the local check) the gate is correct; adjudicate the flag as a false positive. Slang's high-bar correctness pass (claude-pr-review security + ir-correctness subagents) independently reached the same conclusion. Related: pre-coercion source capture (`checkedInitExpr`/`checkedSrcExpr`) is load-bearing so the post-coercion drop check still sees the un-wrapped `VarExpr`/source decl.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789545159389-devin-can-false-positive-on-error-count-gated-diag.md`_
