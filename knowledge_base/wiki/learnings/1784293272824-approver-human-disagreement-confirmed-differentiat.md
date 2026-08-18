---
title: "[approver/human-disagreement] confirmed: differentiating a read through a user-defined ref subscript accessor silently returns a 0 gradient (slang, experimental)"
type: learning
topic: review-approval
source: learnings/1784293272824-approver-human-disagreement-confirmed-differentiat.md
---

# [approver/human-disagreement] confirmed: differentiating a read through a user-defined ref subscript accessor silently returns a 0 gradient (slang, experimental)

**Confirmed real regression, runtime-proven post-merge (slang#12031, merged @ a8d13d6 behind `-experimental-feature`).**

**Symptom:** `[Differentiable] float readRefCell(RefCell v, int i){ return v[i]; }` where `v[i]` resolves to a user-defined `ref { return value; }` subscript accessor. `fwd_diff(readRefCell)` neither errors nor differentiates correctly — it **silently returns a 0 gradient**. Runtime evidence: slangi INTERPRET faults (`VM pointer access does not belong to a known section or parameter`, exit 5); slangc compiles clean with NO diagnostic; emitted `-target cpp` shows the compiler's own forward-derivative doing `DiffPair_float _S8 = { *_S7, 0.0f };` — it derefs the ref-accessor derivative result as a pointer and **hardcodes the differential to 0.0f**. Control: the same read through a value/`get` accessor correctly propagates the derivative (DIFF=20.0). Only the `ref` accessor breaks.

**Root cause:** a `ref` accessor has a value result in the AST but a pointer result in IR (`visitAccessorDecl`); lowering emits `%p = call @refAccessor : Ptr<float>` + `%val = load %p`. A value-pair custom derivative can't differentiate the pointer-producing accessor call, so the differential is dropped. slang#12031's R3 added a diagnostic (err-41037 `cannot-differentiate-through-ref-accessor`) that caught exactly this; the author then REVERTED it at R4 (calling read-through-ref a "pre-existing unsupported boundary") and that reverted state shipped. So "unsupported" manifests as silent-zero, not an error.

**Calibration for the approver:** the shadow decision on R4 was ABSTAIN_INFRA/CHALLENGER_INCOMPLETE (the runtime probe outran the session before merge) + a merge=APPROVED human join. The post-merge probe CONFIRMED the reviewer's code-traced (a) — so the ABSTAIN was correctly cautious; a WOULD_APPROVE would have been a false-safe on a real (if experimental-gated) silent-wrong-gradient. Lesson: when a reviewer's silent-wrong-gradient trace is high-confidence but unconfirmed, ABSTAIN (never round to the merge), and if the question is cheaply settleable, pursue the confirm even post-merge — the fact is worth having on record for the maintainer.

**How to catch this class:** for autodiff changes, "unsupported" boundaries must ERROR, not silently zero the gradient. Probe: differentiate a read through the construct and inspect the emitted `-target cpp` forward-derivative — a hardcoded `{ ..., 0.0f }` differential (vs a propagated `differential_N`) is the silent-zero signature. Value/get-accessor and trivial-function controls isolate whether only the new construct breaks.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784293272824-approver-human-disagreement-confirmed-differentiat.md`_
