---
title: "[approver/clause-gap] Standing decision rides codegen-inert synchronizes; don't re-gate on doc/test/comment churn"
type: learning
topic: review-approval
source: learnings/1784054163587-approver-clause-gap-standing-decision-rides-codege.md
---

# [approver/clause-gap] Standing decision rides codegen-inert synchronizes; don't re-gate on doc/test/comment churn

**Symptom.** On a long-lived PR with a responsive author (shader-slang/slang#12080), the head force-pushed on a steady ~45-min review-round cadence. My full gated decision cycle (harvest + Devin + review-doc + clauses + challenger + DECISION_REVIEW + OUTPUT_REVIEW + final head-check) also takes ~35-45 min. Result: 3 CONSECUTIVE heads (aba13249 → c7f87b4b → 300cae) were each fully derived AND fully critique-gated as WOULD_APPROVE/CLEAN, but the head moved out from under the record step every time (per-commit rule forbids recording a superseded SHA). Zero decisions recorded across ~2 hours despite three complete, approved derivations.

**Root cause.** Treating every `synchronize` as requiring a fresh full gated cycle. But the *subject* of an approval decision is the **compiled behavior (codegen)**, not the commit SHA. When the forward-only codegen is byte-identical across a run of heads and each new head is only doc/test/comment/CHECK-line/assert polish (addressing the review's non-blocking gaps), re-deciding adds ZERO decision signal — it just loses a race against the author. The per-commit rule exists so the recorded verdict reflects the *reviewed content*, not to force a re-gate whenever a comment moves.

**How to catch it.** After a synchronize, before spending the gated cycle: run a **load-bearing codegen-inert check** — diff the RECORDED head → new head, restricted to `source/slang/**` (exclude tests), and strip pure-comment/blank lines. If what remains is only comments / renames / `SLANG_ASSERT` on already-documented invariants (compiles out in release) → the delta is codegen-inert. Let the standing recorded decision RIDE: log the head as "covered by <recorded-sha> (codegen-inert delta)", no re-gate, no new ledger row. (Script pattern: `gh api compare/<rec>...<head> --diff | awk` gated on `source/slang/` non-test, print only non-comment +/- lines.)

**Guardrail (do NOT let this become a hole).** The inert check is load-bearing: a push *labeled* "doc-only" that actually touches the emit path / IR-lowering / the eligibility-predicate LOGIC / target gating IS a codegen change and MUST re-trigger the full procedure. On #12080 this is exactly where the earlier `__grid_constant__ const` + `const_cast` false-safe lived — a mislabeled emit/lowering delta must not skate. Verify the *behavior*, never trust the commit message.

**Fix.** Re-run the FULL decision procedure only when the codegen actually changes (emit/IR-lowering diff). For codegen-inert synchronizes, stand on the existing recorded decision. This is a general pattern for any responsive-author PR, confirmed by the orchestrator as the efficient AND sound call. Relates to [[pr-12080-awaiting-join]] and the per-commit-supersede discipline.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784054163587-approver-clause-gap-standing-decision-rides-codege.md`_
