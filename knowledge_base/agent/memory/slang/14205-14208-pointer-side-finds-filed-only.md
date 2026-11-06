---
type: chain
title: "#14055 side finds filed-only — #14205 render-test -entry, #14206 GLSL bit_cast intptr, #14207 SPIR-V null Workgroup ptr, #14208 NVIDIA PSB bitcast driver crash"
description: Four bot issues filed 11-02 from the #14055 chain's released held list (filed-only, no fixer chains). jkwak-work took all four into the Q1 2027 backlog 11-04 (rung 4). Operator triage asks answered 11-05 (#14205, #14206 by Main; #14208 by slang-triager). Their issue_opened webhooks need no dispatch.
tags: [pointers, side-find, filed-only, spirv, glsl, render-test]
---

# #14055 side finds that were filed with no fixer chain

Spawned by [[slang/14055-parser-multiply-deref-pointer.md]]; the sibling side finds with PRs are [[slang/14078-pointer-emit-pr-stack.md]],
and the maintainer-parked ones are [[slang/14086-14089-pointer-semantics-parked.md]]. All four were filed 11-02 22:1xZ by slang-triager,
re-verified on master 9b46bca64. **A fixer chain on any of them needs the operator's go** (operator told, dashboard a2a 13).

**Maintainer pass (11-04 ~17:10–17:16Z).** jkwak-work self-assigned #14205/#14206/#14208, assigned #14207 to jhelferty-nv, set milestone
`Q1 2027 (Winter)` on all four, and added `Diagnostics` on #14208. That is a backlog pass, not a stand-down request; each is held under rung 4.

| issue | what | verdict / state |
|---|---|---|
| **#14205** (H1) | render-test ignores `-entry`: `entryPointName` is written only at tools/render-test/options.cpp:303 and never read; the compute name is fixed at slang-support.cpp:802. All 194 `-entry` rows use `computeMain`, so none is vacuous today | Main 11-05 (re-verified on 04d2726db): test infra, P3 latent, not a compiler bug. Leave to jkwak-work unless the operator asks for a bot draft PR |
| **#14206** (H3) | GLSL `bit_cast<uintptr_t/intptr_t>(double)` → E99999 (no IntPtr/UIntPtr arm in the #14084 switch) | Main 11-05 (11-02 Release build + master 04d2726db0): target-emit/GLSL, P3. Workaround `bit_cast<uint64_t>`. The SPIR-V form gives E99997 = #8480 (draft #13201). A fixer, if the operator says go, folds into #14085 |
| **#14207** (H4) | direct SPIR-V null Workgroup pointer → `processPtrLit` (spirv-legalize:2122) → `OpConvertUToPtr`, rejected by spirv-val; a logical null needs `OpConstantNull` | filed-only; assignee jhelferty-nv |
| **#14208** (H5) | NVIDIA driver crash at pipeline creation | **Triaged 11-05 12:02Z** by slang-triager (comment 6657471086, no @-mentions, checked live): a driver bug on valid SPIR-V. Trigger: a signedness-only (int↔uint) PSB pointer `OpBitcast` of an `OpPtrAccessChain`/`OpAccessChain` result, so `*(int*)&sp->uintField` crashes too; lavapipe gives the right value. P2. Maintainer options: (1) driver report, (2) `processBitCast` → CastPtrToInt+CastIntToPtr (costs Int64), (3) integer PSB offsets as in #14305 (misses the field case), or (1)+(2). Triager re-check 11-12 12:00Z; memo `/workspace/agent/reports/triage/triage-14208.md`; triager session `f9wg1d`, told no fixers |

H2 of the held list (direct SPIR-V zero-extends a narrow signed `CastIntToPtr`) is marked not-to-file.
