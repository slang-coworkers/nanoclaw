---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786453650870-pwn340
written_at: 2026-08-11T13:39:22.285Z
---

# [approver/challenger-miss] A reviewer's 🔴 severity is a claim to audit, not a verdict to inherit — hedged wording is the tell

# [approver/challenger-miss] A reviewer's 🔴 severity is a claim to audit, not a verdict to inherit — hedged wording is the tell

**Symptom.** On shader-slang/slang#12459 @`c507078f64aa`, the (crashed) production review's `code-quality-reviewer` returned what it labelled a **bug**: in `slang-ir-lower-dynamic-dispatch-insts.cpp` the new pack-rewrite loop reads `value->getDataType()` and casts it back to `IRUntaggedUnionType` *after* `untaggedUnionType->replaceUsesWith(payloadType)` at :749 — "**may** use stale union type after `replaceUsesWith`".

Step 2 of the approver procedure says *any 🔴 Bug ⇒ BLOCK*. Taking the marker at face value lands a BLOCK on a member's PR.

**Root cause.** The finding was **hedged, not demonstrated**. Its own remediation gave it away: "The current code assumes `replaceUsesWith` does not affect operands' `getDataType()` results, which **should be documented or asserted**." A reviewer that had proven a miscompile would describe the wrong output, not request a comment. Checked against source: a value's type lives in `IRInst::typeUse` (`source/slang/slang-ir.h:687`, `getFullType()` at `:689`) — a real `IRUse`, so `_replaceInstUsesWith` rewrites dependents' data types along with everything else. The read is not stale; the nested-union unwrap at `:760-765` is defensive re-normalization for unions `processModule` has not visited yet (arbitrary iteration order), which is what the *clarity* reviewer independently flagged — as an unexplained-code concern, correctly, not as a bug.

So: two reviewers saw the same lines; one called it a bug, one called it under-commented. The second was right about the class.

**How to catch it.** Before letting a 🔴 drive BLOCK, read the finding's *own language* for a demonstration:
- **Demonstrated**: names the input shape, the wrong output/abort, or a failing test. ⇒ verify and BLOCK.
- **Hedged**: "may", "could", "assumes X, which should be documented/asserted", "if two structurally identical but pointer-distinct …". ⇒ a *hypothesis* with a severity marker attached. Open the cited file:line and settle it from source.
A 🔴 whose fix is "add a comment" is a documentation finding wearing a bug's marker. Note the asymmetry: the severity *label* is cheap for a reviewer to over-set; the *wording* is where its actual confidence leaks.

**Fix.** Verify the mechanism the finding depends on (here: whether type uses participate in `replaceUsesWith`), then reclassify. Record the audit in the decision so the human sees both the reviewer's claim and the refutation — the marker gets downgraded on evidence, never on convenience.

**Generalization (the transferable bit).** *Severity is metadata authored by a fallible upstream; the evidence is the artifact.* This is the same discipline as never inheriting a CI colour without resolving what it was computed over. Inheriting a marker feels like deference to a reviewer, but it is really an unverified claim entering my decision through a channel I don't audit — and it fails in **both** directions: a hedged 🔴 can manufacture a BLOCK, and a confidently-worded 🟡 can hide something that deserved one. Audit the wording, then the source.
