---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787758843776-b0mp3k
written_at: 2026-08-26T16:42:31.604Z
---

# [approver/challenger-calibration] Layout-decoration PR: the deterministic FileCheck emission test IS the trigger-present control — check it distinguishes live-from-dead before clearing a "GPU-only test" gap

Symptom: A SPIR-V layout-decoration fix (slang#12698 — `getPointerArrayStrideValue` broadened `as<IRUnsizedArrayType>`→`as<IRArrayTypeBase>` so a Storage/PhysicalStorageBuffer pointer to a *sized* array carries the array **element** stride, not the whole-array object size). The primary bot review flagged one 🟡 gap: "the new runtime regression test is GPU-only / driver-dependent — Mesa/RADV ignore the pointer ArrayStride decoration, so it passes even WITH the bug." That is a real weakness of the *runtime* test.

Root cause of the (avoided) trap: for a layout-decoration-only change, a byte-identical revert-drill and a driver-tolerant GPU test can both be green *by construction* — carrying zero bits about whether the fix is live (the standing "positive control required" challenger discipline). So a GPU-only test looks like a blocking coverage gap.

How to catch it / what cleared it: the PR ALSO updated a deterministic `//TEST:SIMPLE(filecheck=CHECK)` emission test (`tests/spirv/type-layout-memoization.slang`) that asserts the EXACT new stride literals (`ArrayStride 16`/`8`) on the top-level `LayoutPtr<float2[2]>` PhysicalStorageBuffer pointers. Revert the source branch and it emits `32`/`16` → the CHECK FAILS. That is a genuine trigger-present control — it structurally distinguishes a live gate from a dead one, which the GPU test cannot. So the 🟡 gap CLEARS (advisory) rather than blocks.

Fix (transferable rule): when a layout/codegen PR's only flagged gap is "runtime test is driver-dependent", DON'T stop there — look for an accompanying deterministic emission FileCheck test and verify it (a) asserts the exact changed literal and (b) would fail on revert. If such a control exists and is trigger-present, the driver-dependent runtime test is a belt-and-suspenders extra, not the sole guard, and the gap clears. If NO deterministic emission control exists and only the driver-tolerant runtime test guards the change → that IS an OPEN_GAP (abstain), because nothing in CI fails when the fix regresses.

Bonus mechanism verified here: for a `LayoutPtr<T[N]>`, whole-object stepping (`p[i]`/`p+1`) lowers to `OpPtrAccessChain` on the `_Array_...` STRUCT-WRAPPER pointer (whole-object stride, unchanged), while the raw `_arr_...` array pointer only ever feeds an element-indexing `OpAccessChain` — so retargeting the raw array pointer's ArrayStride to the element stride is at the right layer and does NOT regress pointer arithmetic. Confirm this from emitted SPIR-V (the access-chain graph), not from the comment.
