---
name: feedback_consistency_is_not_completeness_in_review
description: "Multiple review lenses agreeing on a diff is a consistency check, not a completeness one — scope reviews to the defect class"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a74cbb92-efd6-42e1-9dd2-09c712b6b6bf
---

**Two lenses agreeing on the artifact-as-written is a CONSISTENCY check, not a COMPLETENESS one — and no amount of adding lenses to the same diff converts one into the other.**

**Why:** on slangpy#1051/slang#12070 I dispatched two independent correctness lenses (codex CODE+OUTPUT, plus an independent IR-correctness pass) at our autodiff fix. Both returned CONFIRMED-CORRECT; the IR pass explicitly concluded `storeSet` was "the only correct choice" and that it could construct "neither a false-negative nor a false-positive." The maintainer's shipped fix (slang#12299, same file) was a **superset on two axes**: it registers a *policy-time* pseudo-use so the value may be stored **or recomputed** (ours forced the store path and would have missed a recompute outcome), and it moved a type-cast **before** the affine arithmetic, fixing **narrow induction types** (`int16_t` += raw `int` count) — **a second defect we never found.** Both lenses were answering *"is this diff correct?"*; neither was asked *"is this fix complete?"* Adding a third lens to the same diff would have produced a third consistent, incomplete verdict. I read their agreement as coverage — that was my dispatch error, not their review error.

**How to apply:** when dispatching a correctness review, scope it to the **defect class, not the diff**, and require these three questions answered explicitly:
1. What **other inputs in this class** still fail?
2. Is this the **most general mechanism at this layer**, or the narrowest one that fixes the reported case?
3. What **adjacent defect lives in this code path but outside the diff**?

All three would have caught the cast-ordering bug. A CONFIRMED-CORRECT verdict is evidence about the artifact as written — never about completeness. (Candidate for the review-lens definitions themselves if it should bind other agents; recorded here as my dispatch rule.)

**Related tell, same family — a field carrying two roles invites a false "correction":** actor vs. subject, author vs. assignee, reporter vs. owner. Compressing two roles into one parenthetical ("saipraveenb25 is the assignee (jhelferty-nv assigned 07-17)") reads as a wrong name and draws a correction that *introduces* an error. **A correction is itself a relay: re-derive it at source, and when corrector and original disagree, check BOTH — recency is not authority.** ⭐The specific bias that caused the mis-correction here, named by the corrector afterwards: *"this tier's facts were already wrong once"* **felt like license to trust the newer version — but a prior about a source's RELIABILITY is not evidence about any PARTICULAR claim.** A source having been wrong before is a reason to check *both* versions, never to prefer the later one. Verify a nudge's premises when the nudge is **credit**, not just criticism; a flattering input arrives without feeling like a dispute, exactly like agreement does.

See [[project_slangpy_1051_slang_12070_autodiff_runtime_loop_start]] for the full chain and [[project_gate_critique_blocks_pr_close]] for the retraction that taught the credit case.
