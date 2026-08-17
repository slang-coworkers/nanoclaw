---
title: "[approver/confirmed-safe] correct-layer producer fix for a 'produced-once/consumed-nowhere/emitted-nowhere' IR op — clear it by proving the op is no longer MATERIALIZED, not just dropped"
type: learning
topic: review-approval
source: learnings/1784113889947-approver-confirmed-safe-correct-layer-producer-fix.md
---

# [approver/confirmed-safe] correct-layer producer fix for a "produced-once/consumed-nowhere/emitted-nowhere" IR op — clear it by proving the op is no longer MATERIALIZED, not just dropped

**Context:** PR #12117 "lower `(void)expr` to the canonical void value" — the producer-side redo of #11315 that #11323's post-mortem predicted. #11323 (drop `kIROp_CastToVoid` before emit) was closed by skiminki-nv as *wrong-layer*: "never produce CastToVoid in the first place." #12117 is the fix at the layer that answer pointed to. Decided WOULD_APPROVE (CLEAN); this is the confirmed-safe checklist for that class.

**The class of change:** an IR op that is *produced* at one or more sites, *consumed by no emitter* (its absence in every backend WAS the original bug — internal "unimplemented" abort), and whose result type makes it semantically a no-op (here: `void`, single canonical spelling). The principled fix stops *materializing* the op and returns the canonical value instead.

**What to verify to clear it (all held for #12117):**
1. **Op no longer materialized at EVERY producer site.** `git grep <Op>` at head vs master. #12117: master had 6 producer refs (5 in `emitCast` opMap + 1 `emitCallToDeclRef` default fall-through); head has 0 materialization — both paths now return `getVoidValue()`. A partial removal (one site fixed, another still emits) would be a real gap.
2. **Op ENUM retained iff it still has a non-IR role.** `kIROp_CastToVoid` stays defined because `core.meta.slang` uses it as the `__intrinsic_op(...)` *identity* of the `__init(void)(T)` builtin — that's the front-end selector `emitCallToDeclRef` switches on, NOT an IR inst. Retaining the enum while never building the inst is correct; it does not create a second representation.
3. **The canonical value is genuinely canonical.** `getVoidValue()` → `_findOrEmitConstant(IRVoidLit)` = deduplicated single literal. No transient/invalid SSA created (it's a hoisted constant, precedent at emitDefaultConstruct void sites). So the recall-flagged "transient invalid SSA" hazard is N/A for constant-returning fixes.
4. **Table/index shrink is bounds-safe.** Dropping the op's column from a `[N][M]` dispatch table: confirm the dropped index is only ever reached AFTER an early-return/UNREACHABLE guard. #12117: `opMap[5][6]→[5][5]`; Void=5 (last enum) and Unknown=-1 both intercepted before indexing ⇒ indices ∈[0,4]. (Reviewer's 🟡: a future enum-reorder could break this — pure future-proofing, clears advisory.)
5. **The invariant the op enforced is preserved elsewhere.** For a `(void)` cast, front-end `[NoDiscard]`/E30059 enforcement must be untouched — diff touched 0 front-end check files; the cast still type-checks as a *use* (silences E30059), pinned by a test.
6. **Side effects survive.** Discarding the *SSA value reference* to the operand does not remove the side-effecting insts that computed it (already emitted; inout store survives DCE). Pin behaviorally (#12117: buffer 12345678→12345679 through `(void)incrementValue(output[0])`).

**Lesson for Step-0 recall:** when a diff *removes* a producer path for a no-op/never-emitted IR op (the inverse of #11323's "add a downstream drop"), that's the sanctioned direction — but clear it by proving items 1-6, especially that materialization is gone at ALL sites and the enum's residual role is front-end-only. Links: [[pr-11323-decided]], the #11315 arc.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784113889947-approver-confirmed-safe-correct-layer-producer-fix.md`_
