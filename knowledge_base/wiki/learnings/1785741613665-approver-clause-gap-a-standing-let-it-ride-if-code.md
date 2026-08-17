---
title: "[approver/clause-gap] A standing 'let it ride if codegen-inert' decision expires when the author pivots design — check the subject-of-record still EXISTS, not just that it is unchanged"
type: learning
topic: review-approval
source: learnings/1785741613665-approver-clause-gap-a-standing-let-it-ride-if-code.md
---

# [approver/clause-gap] A standing "let it ride if codegen-inert" decision expires when the author pivots design — check the subject-of-record still EXISTS, not just that it is unchanged

## Symptom

shader-slang/slang#12080 carried a **standing** approval: re-run the full gated procedure only when
the codegen actually changes; on a codegen-inert synchronize, let the recorded row ride and just log
the head as covered. That rule worked for ~6 heads of doc/test/comment nit-polish.

Revisiting the PR ~18 heads later, the naive inert check said "everything changed" (the branch had
been rebased onto newer master, so master drift touched all 11 files) — a result that is
simultaneously alarming and uninformative. The real finding was worse than drift: **the
subject-of-record no longer existed.**

## Root cause

Both recorded rows (`@25d93101`, `@f3b288723340`) approved one specific lowering — forwarding a
uniform aggregate's address into a `borrow in` callee:

```cpp
builder.emitGetAddress(builder.getPtrType(arg->getDataType()), arg);   // f3b2887
```

At the new head that line is **absent**. The author had pivoted to a third design: retype the
parameter itself instead of taking the address of an SSA value —

```cpp
param->setFullType(builder.getBorrowInParamType(valueType, AddressSpace::CudaKernelParam));
```

plus a brand-new `AddressSpace::CudaKernelParam` enumerator, in-kernel value reads redirected through
an explicit `IRLoad`, `fixUpFuncType` on the entry point, a new SPIR-V address-space case, and a new
`lowerImmutableBufferLoadForCUDA` pass. Design lineage for this one PR:

1. `__grid_constant__` + `const_cast` — **approved 4×**, later reported to MISCOMPILE on sm_100/NVRTC
2. forward-only `emitGetAddress` — the 2 standing rows
3. param-retype / `CudaKernelParam` — current, **never decided**

The inert check was built to answer *"did the approved codegen change?"* It silently mis-answers when
the approved codegen was **deleted and replaced**. A diff-shaped question assumes both sides still
describe the same construct; a pivot breaks that premise. Left unchecked, the standing rule would have
let a 4×-burned design lineage ride onto an undecided third implementation — the exact structural
setup that produced the original `__grid_constant__` false-safe.

## How to catch it

Make the inert check **existence-first**, and make it answer about the construct, not the bytes:

1. **Assert the subject-of-record is still present.** Grep the new head for the specific
   call/predicate/gating the row approved. Absent ⇒ **the row is stale — retire it, full re-gate.**
   Do this *before* any diff.
2. **Grep for new load-bearing vocabulary** — a new `AddressSpace` enumerator, a new `SLANG_PASS`,
   a new IR op, a new `setFullType` call. New vocabulary means new design, not polish.
3. **Neutralize rebase contamination**: fetch file content at both SHAs and diff directly
   (`raw.githubusercontent.com/{repo}/{sha}/{path}`). `gh compare` is merge-base-contaminated on a
   diverged branch — the pre-existing lesson from this same PR, where it would have masked a
   one-line `getFullType()`→`getDataType()` change. But note "all files changed" from a true content
   diff still can't distinguish master drift from a pivot — that's what step 1 is for.
4. **Cap the standing rule by head count.** A rule that has ridden ~18 heads across 3 weeks has
   outlived its evidence regardless of what any diff says.

## Fix

A standing decision is scoped to **a design, identified by a construct that must still exist** — not
to a PR number and not to "no diff in these files." Two exit conditions, either one retires it:

- the approved construct changed (the original guardrail), **or**
- the approved construct is **gone** (this gap).

Write the row's subject-of-record as a **greppable anchor** (`emitGetAddress(getPtrType(...), arg)`)
so the existence check is mechanical. When it fires: retire the rows as descriptions of the live PR
(they still stand for their own commits — per-commit recording is unchanged), and re-gate from
scratch. Also re-derive `mode`: human reviews accumulated during the ride, so what began `live` is
now `live_late`.

Related: the memory-index entry must be rewritten too. Leaving "standing / re-gate only on genuine
emit change" in the loaded index invites a future session to ride a row whose subject no longer
exists — the index line is itself a load-bearing artifact.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785741613665-approver-clause-gap-a-standing-let-it-ride-if-code.md`_
