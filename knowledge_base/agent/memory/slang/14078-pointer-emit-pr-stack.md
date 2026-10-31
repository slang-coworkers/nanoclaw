---
type: chain
title: "#14055 side-find PR stack — GLSL/SPIR-V pointer emit (#14078/#14080, #14082/#14088, #14084/#14085, #14087/#14090)"
description: Four bot-filed issues spawned by the #14055 chain, each with a bot draft PR, all validated under the CI env and PARKED on the operator ready flip (#14088 also on #14080 merging). Their issue_opened webhooks need no dispatch.
tags: [glsl, spirv, pointers, side-find, ready-flip]
---

# #14055 side finds with PRs: pointer emit on GLSL / SPIR-V

Spawned by [[14055-parser-multiply-deref-pointer.md]]; the two maintainer-parked siblings are in
[[14086-14089-pointer-semantics-parked.md]]. All four issues were filed by slang-triager as bot issues.
I verified on GitHub that no body, PR or comment references #14055 (the R6 cross-ref rule). **Their
`issue_opened` webhooks reached Main 10-30 and need no dispatch.** Fixer [Fix Report]s keep drifting to
Main; forward them to the triager (`1k60r3`, pinned, `in_reply_to=2`).

## State (10-30 06:01Z; fixer/reviewer figures, heads verified by me on GitHub)

| issue | PR (base) | head | review | validated (CI env) | parked on |
|---|---|---|---|---|---|
| #14078 GLSL ptr→ptr cast `(float*)intPtr` → E99999, P2 | draft #14080 (master) | 94cdaea3e | R1 + delta APPROVE_WITH_NITS, 0 bugs; reviewer acked the scoping | 14/14, 65/65, 71/71, 3407/3407; spirv-val 7/7 via-GLSL | operator ready flip (re-offered 04:41Z) |
| #14082 GLSL buffer-ref emit: null as `0`, `void _data`, P3 | draft #14088 (`fix/issue-14078`) | d8cb400a2 | R1 REQUEST_CHANGES → R2 APPROVE 0/0/0 (05:58Z) | 858/859 + 521/522 (only #14087), spirv-val 8/8 | #14080 merging → retarget to master (**merge** master/#14080 final head, not rebase — #12194 rule; fixer acked 06:02Z) → flip |
| #14084 GLSL `bit_cast<uint64_t>(double)` requests no int64 ext, P3 | draft #14085 (master) | 8cb0f1142 | R1 APPROVE_WITH_NITS 0/0, nits applied | 8/8 + subset 1950/1950 (328 vk legs) | operator flip (re-offered 04:39Z, after #14080) |
| #14087 SPIR-V `(int64_t)ptr` → OpConvertPtrToU with signed result | draft #14090 (master) | a07befd | R1 APPROVE_WITH_NITS 0/0/0, nits applied | full suite 11093/11096 (3 known fp8-cuda) | operator flip; assignee jkwak-work (shepherd) |

Fixer owner sessions: #14078 `sess-1793320862886-o2rgdf`, #14084 `sess-1793329242871-4puih2`,
#14087 `sess-1793334766276-bdw93c`; #14082 in worktree `wt-slang-14082`.
**Follow-up:** drop #14080's `-DNO_SIGNED_PTR_TO_INT` scoping in whichever of #14080/#14090 merges second.
**Real CI runs only after the ready flip.** On a draft, CI 41004061243 was the priority-yield
(`wait-for-human-priority` + `check-ci` failed, 40 skipped, `falcor-build-approval-gate` waiting), so
"wait for green CI before the flip" is circular; CI is the post-flip check.

## #14078 → #14080

Filed 00:40:19Z (triage comment 6512026888, status comment 6512901925). The fixer chose **approach B**
(GLSL `kIROp_BitCast` emit) over A (`lowerBitCast` → `PtrCast`), because `bitCast(uint64/uint2 ↔ T*)` is a
valid IR shape with several producers (`bit_cast<float*>(uint64_t)`, pointer struct fields, existentials).
- R1 02:27Z (memo `/workspace/inbox/a2a-1793327240072-g2bbtr/combined-review.md`): G1, the `-entry packedMain`
  Vulkan rows were vacuous (render-test ignores `-entry`); G2, an undisclosed uvec2 pack-only fix had no test.
  Applied at e0542eb81.
- Flip held 03:0xZ: the new `SLANG_RELEASE_ASSERT` in `_emitBufferReferenceConversion` could fire on a user
  `__intrinsic_op(CastIntToPtr) int* f(uint)` (E99997). 25f581c53 writes any other integer/bool as
  `T(uint64_t(x))`; the assert now rejects only non-integer `__intrinsic_op` misuse (→ E99999, accepted).
  Front-end inits widen to Int64/UInt64 first (core.meta.slang:1507-1511); the one unguarded producer is the
  `IRBuilder::emitCast` table (slang-ir.cpp:4463-4477), Int/Bool → `CastIntToPtr`. Same commit fixed #14082
  item 2. Delta review e0542eb81..79415a26c 04:00Z APPROVE_WITH_NITS; description now names the signed fix.
- Flip re-held 04:29Z: the direct-SPIR-V leg (`.2`) of `ptr-to-ptr-cast-glsl.slang` fails spirv-val
  (pre-existing, became #14087). 94cdaea3e builds that row with `-DNO_SIGNED_PTR_TO_INT` and a note.

## #14082 → #14088

Filed 01:59Z (triage comment 6513082988): `kIROp_PtrLit` at emit-glsl:2894, signed ctor at :2904,
`emitBufferPointerTypeDefinition` at :2185. Item 1 of the fixer's 4 shapes duplicated #13393 (older #8630;
draft bot PR #13410). Handoff held until #14080's [Fix Report] (same emit cases), claimed 02:59Z, stacked.
After 25f581c53 it covers items 1 and 3. Item 1 also fixes shared `slang-emit-c-like.cpp`: the emit-action
pass skipped `IRPtrLit`, so a pointer type used only by a null literal never got its block declared
(cross-backend scope). No restack needed (merge-tree clean). R1 05:27Z B1: a null groupshared ptr via GLSL
gave an undeclared `_S2(0UL)`; fixed by gating the PtrLit ctor on `isUserPointerType`. R2 dropped the Q2
stride sentence, so #14089 stays open. 06:01Z [Fix Report]: 7 files +133/−23.

## #14084 → #14085

The #14080 reviewer's 5th side find. Filed 03:01Z (triage comment 6513880328). emit-glsl:2431/:2444 write a
fixed `uint64_t(doubleBitsToUint64(`, bypassing `_requireBaseType`, so no int64 `#extension` is requested;
fails back to v2025.6.2. Base master (different BitCast arm). R1 03:59Z (memo
`/workspace/inbox/a2a-1793332773272-fe7i6j/combined-review.md`): N1 the NOT guard missed conversions
(mutation-confirmed), N2 a comment. [Fix Report] 04:09Z, CI 41001298305.

## #14087 → #14090

Filed 04:33Z (triage comment 6515038276). `emitCastPtrToInt` (slang-emit-spirv.cpp:9744) emits
`OpConvertPtrToU` with `inst->getFullType()`, so a signed `int64_t`/`intptr_t` result is invalid. Fix:
`OpConvertPtrToU` to uint64 + `OpBitcast`, width-generic. `emitCastIntToPtr` with a signed operand validates
(no twin). `(intptr_t)q` stops at E99997 = #13200 (draft #13202). Draft 05:14Z; R1 05:42Z (memo
`/workspace/inbox/a2a-1793338968319-spxcr6/combined-review.md`); [Fix Report] 05:50Z, CI 41010144027.

## Lessons

- **Validate under the CI env before offering any flip.** CI exports `SLANG_RUN_SPIRV_VALIDATION=1`
  (`ci-slang-test.yml:149`); every "14/14" before 04:29Z was unvalidated. Use
  `SLANG_RUN_SPIRV_VALIDATION=1 SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1`, and run in-tree spirv-val on via-GLSL
  binaries separately: the env var does not validate them (shared learning `ag-…vmjrwe/1790964997075`). The
  `VK_LAYER_KHRONOS_validation` leg is CI-only.
- **A behavior change after an approval gets a delta review** before the flip is re-offered.
- Not filed: direct SPIR-V zero-extends a narrow signed `CastIntToPtr` while GLSL/CUDA sign-extend; reachable
  only through a user `__intrinsic_op`.
