---
type: chain-record
description: Identity-intrinsic type drop → invalid SPIR-V/GLSL; fixed in draft PR #14580, review-complete, ready-flip pending
---

# slang#14576: __intrinsic_op(0) identity drops declared result type (invalid SPIR-V)

**Issue:** https://github.com/shader-slang/slang/issues/14576 (filed 11-18 by jkwak-work, self-assigned; P2 bug, not a regression).
`__intrinsic_op(0)` on an `__intrinsic_type(UInt)` struct substituted the bare operand, keeping `uint` where `int` was declared →
spirv-val OpStore/OpReturnValue type mismatch; same cause fails the `glsl` target via glslang (maintainer comment 6969791344, 11-18).

**Chain:** dispatched slang-triager 04:40Z → triage (reproduced on rebuilt master, labels `reproduced`/Bug) → slang-fixer session
sess-1794977256768-8qeem3 → **draft PR #14580** (branch fix/issue-14576, opened ~06:04Z; explanation comment 6970612902).

**Fix:** both identity producer sites (`emitCallToDeclRef` op==0 in slang-lower-to-ir.cpp; `kIROp_Nop` branch in slang-ir-inline.cpp)
re-type through one shared `retypeIdentityIntrinsicResult` helper (slang-ir-util), guarded by `isSameSizeFixedBasicTypePair` — bit-cast
exactly when both types are same-size fixed basic types (bool/char/packed-floats/intptr excluded as target-size-dependent).
Unguarded first version failed 208 suite tests — full-suite sweep caught it pre-ship.

**State (11-18 09:27Z Fix Report):** review fully complete — R1 REQUEST_CHANGES applied, R2 APPROVE_WITH_NITS with all nits applied,
codex CODE_REVIEW re-approved at head `14d096f77`. Suite 12337/12340 (3 pre-existing fp8-cuda, revert-drill-proven). 12/12 dedicated
legs on L40S incl. vk + via-glsl under SLANG_RUN_SPIRV_VALIDATION=1; spirv-asm pins OpBitcast, no OpSConvert. **Ready-flip pending**
(recorded in [orchestrator/undraft-asks-replaced-by-weekly-list.md](orchestrator/undraft-asks-replaced-by-weekly-list.md)) — P2, no
fast-flip ask. Awaiting human review; issue closes when PR merges. **Post-merge:** maintainer's PR #14561 drops its `targets=all-vk-glsl`
exclusion on rebase. Scoping note: `__intrinsic_type`/`__intrinsic_op` accepted in user code today (#13550 tracks policy) — fix belongs in
the compiler, not the test.
