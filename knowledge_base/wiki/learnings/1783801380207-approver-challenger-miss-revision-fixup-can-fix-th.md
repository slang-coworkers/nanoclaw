---
title: "[approver/challenger-miss] Revision fixup can fix the flagged side while the OTHER changed file's concern stays byte-identical — diff R0↔R1 per-file before trusting 'author addressed it'"
type: learning
topic: review-approval
source: learnings/1783801380207-approver-challenger-miss-revision-fixup-can-fix-th.md
---

# [approver/challenger-miss] Revision fixup can fix the flagged side while the OTHER changed file's concern stays byte-identical — diff R0↔R1 per-file before trusting "author addressed it"

**Context:** slang#11475 R1. R0 was BLOCKed for two things in a two-file front-end change: (F4/decl-side) `[Fwd/Backward]DerivativeOf]` imaginary-`this` arg-count over-insertion in `slang-check-decl.cpp`, and (F1/expr-side) `getThisTypeForBaseFunc` using a `DerefMemberExpr`'s **pointer** type as `this` in `slang-check-expr.cpp` (because `DerefMemberExpr : public MemberExpr`, so `as<MemberExpr>(innerExpr)` matches `p->method`). The maintainer pushed a fixup commit titled "Validate derivative receivers from checked callables" that the orchestrator framed as "addressing your BLOCK."

**Symptom / trap:** The fixup was a principled, well-targeted rework of ONLY the decl-side (`slang-check-decl.cpp` +87/-13: it now derives the imaginary receiver from the *checked higher-order callable's* actual param shape — `newParameterNames[0]=="this"` && `paramCount==explicitArgCount+1` — instead of from the derivative `funcDecl`). It is easy to read "author fixed the block" and relax. But `git`/API blob-compare showed `slang-check-expr.cpp` was **byte-identical** between R0 (`2deab24c4e01`) and R1 (`8d414d99b2d3`) — the expr-side DerefMemberExpr concern (F1) was completely untouched, and its tests unchanged.

**Root cause:** A BLOCK can rest on N independent findings across M changed files. A follow-up commit often targets the loudest/most-recently-discussed finding (here the decl-side arg-count 🔴 Devin named with a line number) and leaves the others. "Author responded to the block" ≠ "author addressed every finding."

**How to catch it:** On a revision (`synchronize`) of a PR you previously decided, before re-deciding: (1) `gh api repos/O/R/compare/<prevHead>...<newHead>` to see EXACTLY which files the fixup touched; (2) for each file that carried a prior finding, blob-compare (`.sha` from `contents?ref=`) prev-vs-new — IDENTICAL means that finding is untouched, full stop; (3) re-derive each prior finding fresh against the new head (prior turns are context, not evidence — one ledger row per commit). Also: a verdict-source (Devin) may re-flag the just-fixed region with the *pre-fix description* while its own narrative says the revision fixes it — reconcile that in the challenger, but per Step-2 "parse, don't reinterpret" a verdict-source 🔴 still maps to BLOCK; investigation can only add caution, never upgrade toward approval.

**Fix / outcome:** R1 → BLOCK on the verdict-source 🔴 (reason `REVIEW_BUG:slang-check-decl.cpp:18994`), with the unaddressed expr-side F1 (DerefMemberExpr, corroborated by the stale primary production review on byte-identical code) as reinforcing corroboration, NOT the ledger basis. Related: [[approver-reviewer-debounce-live-pr-head-churn-then]] (debounce the settled head first).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783801380207-approver-challenger-miss-revision-fixup-can-fix-th.md`_
