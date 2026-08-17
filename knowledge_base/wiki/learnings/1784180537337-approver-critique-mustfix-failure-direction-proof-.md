---
title: "[approver/critique-mustfix] failure-direction proof must check the FALLTHROUGH type, not assume miss=safe"
type: learning
topic: review-approval
source: learnings/1784180537337-approver-critique-mustfix-failure-direction-proof-.md
---

# [approver/critique-mustfix] failure-direction proof must check the FALLTHROUGH type, not assume miss=safe

**Symptom:** On slang#12119 R3 (OptiX SBT __ldg exclusion, the vindicated successor to the #11152 false-safe), the production review flagged that the SBT peel-walker `isAddressIntoOptiXShaderBindingTable` omits `kIROp_PtrCast`. My initial challenger draft CLEARED this gap on a "failure-direction-safe" backstop: I claimed that if the walker misses a forwarding op, `isPointerToImmutableLocation` falls through to `false`/mutable → no `__ldg` → safe. The codex DECISION_REVIEW gate returned must-fix and proved the backstop WRONG.

**Root cause:** The fallthrough is NOT safe for this predicate. `GetOptiXSbtDataPtr` is typed as `ConstantBuffer<>`; `ConstantBufferType` lowers to `AddressSpace::Uniform` (slang-ir-lower-buffer-element-type.cpp:~2570); and `Uniform` IS in the immutable-AS set that `isPointerToImmutableLocation` returns TRUE for (slang-ir-util.cpp:~3150). So a forwarding op the walker fails to peel drops the address to the type/AS tail, which returns TRUE (immutable) → CUDA emits `__ldg` → stale read. That is the EXACT #10188 bug and #11152 mechanism (miss → TRUE → __ldg). The walker is LOAD-BEARING, not an optimization — a miss returns the BUG direction. I had asserted the opposite direction without tracing what type the missed pointer actually carries.

**How to catch it:** When judging a peel/access-chain-walker completeness gap, do NOT stop at "op X isn't peeled, but a miss is safe." Trace the ACTUAL fallthrough: what type/address-space does the un-peeled root carry, and does the tail predicate return the safe or the unsafe value FOR THAT TYPE? Here the SBT root is ConstantBuffer→Uniform→immutable, so the tail returns the unsafe TRUE. The failure direction depends on the fallthrough type, which you must look up — never assume "miss = default = safe." This is the second half of the earlier `[approver/challenger-miss]` learning ("verify BOTH op-set completeness AND fallthrough failure direction") — this time the fallthrough was the trap.

**Fix / outcome:** Decision corrected WOULD_APPROVE → ABSTAIN_POLICY (OPEN_GAP). Not BLOCK: `git grep kIROp_PtrCast` found NO source producer/builder (only emit consumers + op metadata), so no evidenced live trigger — but reachability-absence can't clear a load-bearing gap to the standard #11152 demands (#11152 was exactly a "couldn't-happen" peel omission a legalization pass later triggered). Producer-side fix the reviewer named: add `case kIROp_PtrCast:` beside BitCast/Reinterpret in the walker. Meta-lesson: the critique gate is the backstop that catches a false-safe of the same class as the historical miss — run it hard on the exact file/mechanism where you've been wrong before, and let a must-fix flip the decision rather than defending the draft.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784180537337-approver-critique-mustfix-failure-direction-proof-.md`_
