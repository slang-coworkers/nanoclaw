---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789433439763-si04pd
written_at: 2026-09-15T04:14:15.724Z
---

# CORRECTION: getRootAddr + field-key check is branch-dependent (live on resource-load path, dead on plain-Load path)

Refines the earlier note "CSE gate: a per-field-key qualifier check downstream of getRootAddr() is dead code" — that note was over-broad. Whether the per-field-key `globallycoherent`/`volatile` check inside `isRepeatableReadLocation` is reachable depends on WHICH branch calls it, because `getRootAddr` (slang-ir-util.cpp ~936–953) peels `FieldAddress`/`GetElementPtr`/`NodeOutputRecordGetElementPtr` but does **NOT** peel `kIROp_Load`.

Concrete, verified on shader-slang/slang#13081 (issue #12785), across two review rounds:

- **Resource-load branch — check IS LIVE.** For `structuredBufferLoad(handle, i)` where the resource is a struct member, `operand(0)` = `load(fieldAddr(gp, memberKey))`. `getRootAddr(operand0)` stops at the `Load` (Load isn't peeled), so the chain survives and `isRepeatableReadLocation`'s own peel walks `Load → FieldAddress` and checks the member key. Empirically pinned: a `globallycoherent` ConstantBuffer member is NOT commoned while its plain sibling IS (test `gh-12785-coherent-member.slang`). My round-1 "dead at both call sites" claim was WRONG for this branch.

- **Plain-Load branch — check is BYPASSED.** For a scalar struct-member read `f(){ return cb.x; }` lowering to a bare `kIROp_Load` whose `getPtr()` is `fieldAddr(cb, xKey)` directly (not wrapped in a Load), the branch calls `isRepeatableReadLocation(getRootAddr(getPtr()))`. Here `getRootAddr` peels the `FieldAddress` and hands over the bare root, so the field-key qualifier check never runs — a latent soundness asymmetry (a `volatile`/`coherent` scalar member could be wrongly commoned). Fix: drop the redundant `getRootAddr` on the plain-Load branch and pass the raw `getPtr()` so `isRepeatableReadLocation`'s own peel (which starts at `isPointerToImmutableLocation` and handles FieldAddress/GetElementPtr/Load) does the work.

Reviewer takeaways: (1) When a predicate is written to walk an access chain, check every call site for a pre-peel like `getRootAddr(...)` that strips the very ops the predicate inspects — and do it per-branch, since Load-vs-no-Load changes whether the chain survives. (2) Do NOT pass the un-peeled pointer to the *top-level* eligibility gate as a blanket fix: on CPU/CUDA a `Ptr(StructuredBuffer)` field pointer into `GlobalParams` is not `isPointerToImmutableLocation`-true, so un-peeling there would reject legitimate global reads (the fixer rejected that alt fix for this reason). The correct fix is local to the plain-Load branch. (3) When you post a learning from a first-round review, revisit it after the author's rebuttal — a "verified defeated guard" can turn out to be live on the path that actually matters.
