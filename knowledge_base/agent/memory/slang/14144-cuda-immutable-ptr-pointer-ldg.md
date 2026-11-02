---
type: chain
title: slang#14144 — CUDA `ImmutablePtr` loads of pointer-typed values skip `__ldg`
description: Human-filed (albertrodriguezclo) bug/perf report 2026-11-01 20:25:21Z, cloth-sim batch (siblings #14138, #14141). R6 hold until 2026-11-05 20:25:21Z; Main one-shot r6-release-14144-eb4e at 11-05 20:29Z. Triaged 11-01 20:41Z enhancement/low/P3, rec A; L40S shows no gain and a store-in-loop slowdown. PARKED on operator + csyonghe. Matrix side gap filed by the triager as #14145, owned by this chain.
tags: [cuda, ldg, immutable-ptr, pointers, r6]
resource: https://github.com/shader-slang/slang/issues/14144
---

# slang#14144 — pointer-typed values read through `ImmutablePtr` get a plain load on CUDA

**Ask.** `ImmutablePtr<T>` loads lower to `__ldg` for scalars, vectors, and structs/arrays of those, but a
pointer-typed value (an `ImmutablePtr<float*>` element, or a `float*` member read through
`ImmutablePtr<Node>`) is a plain dereference. Reporter's suggested emit:
`slang_bit_cast<float*>(__ldg((const unsigned long long*)&p))`. Pointed at `createLoadFuncForType` in
`slang-ir-cuda-immutable-load.cpp` (no `kIROp_PtrType` case). Workaround: `ImmutablePtr<uint64_t>` + cast.

**Related.** Same file as the #11152/#12119 OptiX SBT guard
([imported/project_11152_ldg_optix_sbt_false_safe.md](../imported/project_11152_ldg_optix_sbt_false_safe.md)),
#13088 (closed, `__ldg` on `__constant__` params), #10188 (closed). The ImmutablePtr alignment item is
[#13878](../imported/project_13878_aligned_immutable_ptr_loads.md) (human-owned, kaizhangNV). Same reporter:
[#14138](14138-cuda-restrict-pointer.md), [#14141](14141-metal-readonly-pointer-constant-address-space.md).

**Dispatch (11-01 20:2xZ, Orchestrator).** Memory grep on 14144: no hits. Only session on
`gh-issue-shader-slang/slang-14144` is my own webhook session `sess-1793564723597-wau0eq`. GitHub `ldg` search:
no dup. Live: OPEN, 0 comments, no labels, no assignee. Fenced blocks but no crash word, so the **R6 hold applies
until 2026-11-05T20:25:21Z**. Release timer: Main's `r6-release-14144-eb4e` (11-05 20:29Z); the triager was
told not to set its own.

**[Triage] 11-01 20:41Z (slang-triager, memo `/workspace/inbox/a2a-1793565678452-ix7qtr/triage-14144.md`).**
Enhancement / low / P3, not a dup, not a regression (same since PR #8710; 2026.13.1 identical). The cause is a missing
`kIROp_PtrType` case in `createLoadFuncForType` (:107-297). **Wider than reported:** the struct/array cases are
all-or-nothing (:285-289), so a whole-struct `Node` load drops `__ldg` on every field. *I re-verified both at 6815ed82d
with the local Release slangc: `*(outN_0+_S1) = *(nodes_0+_S1)` and a plain float3x3 load.*
L40S SASS: as-is `LDG.E.64`, hand patch `LDG.E.64.CONSTANT` (the reporter's claim holds). **Timing shows no gain, and
one shape is slower:** load-only 107.7 vs 107.7 ms; store-in-loop 65–71 ms as-is vs 108 ms patched; the bit-cast +
plain-load control is 70 ms; nvcc `__restrict__` is 107 ms. So the fix gives nvcc parity, not a speedup, and the
cause of the slowdown is unknown. The SBT and `__constant__` guards run before type dispatch, so a new case cannot reopen
#10188/#13088; the fixer should still add negative tests. Options: **A (rec)** a bit-cast helper (Matrix-case pattern) that
also fixes all-or-nothing; B a prelude `__ldg(T* const*)` overload; C document the workaround. A fix must update the 2
generated boundary tests (`docs/generated/tests/design/target-pipelines/cuda/ldg-{pointer-element-left,struct-with-pointer-field}-unrewritten.slang`)
and `cuda.md:1150-1158`. Conflict risk: open PR #10098 (csyonghe). The draft is held in the triager's
`memory/issues/comment-14144.md`; after the hold, post it, then `reproduced` + Type=Feature.

**Side gap (matrix):** top-level `ImmutablePtr<float3x3>`/`StructuredBuffer<float3x3>` loads are plain, because the
load sits in `[ForceInline] unpackStorage(RefParam)` and the pass runs before `performForceInlining`
(slang-emit.cpp:2721 vs :2724). *Triager correction 20:45Z: the Matrix case is NOT dead code. `row_major` matrices in StructuredBuffer/ImmutablePtr go through it. The gap is only column-major (the default) matrices loaded whole.* My quick dedup found nothing. **Ruling 11-01 (Orchestrator,
per [filing policy](../orchestrator/filing-verified-issues-policy.md)): the triager files it** without naming #14144 and
with no @. It stays filed-only, with no fixer chain. Filed as #14145 (below).

**Operator decision asked 11-01 (dashboard):** after the hold, either post the triage and park for csyonghe
(recommended, because the slowdown makes the fix's value a maintainer call), or start a fixer on A. Timer: `r6-release-14144-eb4e`.

**Second side find (20:45Z, triager):** slangc segfaults in CUDA emit on `ConstantBuffer<row_major floatNxM>`. It is not `__ldg`-related, and 2026.13.1 crashes too. The triager is deduping it and will file it under the policy (no #14144 reference). Both side issues are owned by this chain, so their issue_opened webhooks need no dispatch.

**#14145 filed 11-01 20:47:58Z** (bot, Type=Bug, `reproduced`): "CUDA: a whole column-major matrix loaded from StructuredBuffer or ImmutablePtr gets a plain load, not __ldg". Verified: the body has no #14144 reference and no @. Filed-only, with no fixer chain. **#14145 is owned by this chain, so its issue_opened webhook needs no dispatch.** Its webhook (11-01 20:48Z) was not dispatched; the only session on `gh-issue-shader-slang/slang-14145` is Main's `sess-1793566080663-wubt60`. Conflicts: PR #10098 (keeps the pass before force-inlining) and draft PR #13415 (`shouldLowerMatrixType`). The held #14144 draft links #14145 and states the store-in-loop slowdown. The segfault side find is not yet filed; the triager is locating the crash site first.

**#14146 filed 11-01 20:50:49Z** (bot, Type=Bug, `reproduced`): "CUDA: slangc segfaults when indexing a ConstantBuffer<float3> or ConstantBuffer<row_major float3x3>". Indexing a vector or row-major-matrix CB element on `-target cuda` gives a SIGSEGV at `slang-emit-cpp.cpp:1615` (GetElementPtr: `as<IRPtrTypeBase>` returns null for the PointerLikeType CB). It also crashes on 2026.13.1. *I re-verified 11-01: `ConstantBuffer<float3> sb; o[0]=sb[1];` exits 139 at 6815ed82d.* Verified: the body has no #14144 reference and no @. Filed-only, with no fixer chain. **#14146 is owned by this chain, so its issue_opened webhook needs no dispatch.** Not filed: `ConstantBuffer<float[4]> sb[1]` gives E99999 on CUDA, which is noted in the #14146 body. Its webhook (11-01 20:50Z) was not dispatched; the only session on `gh-issue-shader-slang/slang-14146` is Main's `sess-1793566254805-v32tb3`. Live 11-01: OPEN, 0 comments, `reproduced`, no assignee.
