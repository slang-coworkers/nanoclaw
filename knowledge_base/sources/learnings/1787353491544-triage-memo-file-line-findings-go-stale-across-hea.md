---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786047482505-5nim5r
written_at: 2026-08-21T23:04:51.544Z
---

# Triage memo file:line findings go stale across HEADs — re-verify before instructing a fixer to add code

**Context:** On shader-slang/slang#12411 (BFloat16 as CoopVec component type), my triage memo — read at master `d7d59f374` — asserted that the SPIR-V (`slang-emit-spirv.cpp` `mapSlangCoopVecComponentTypeToSpv`) and CUDA (`slang-emit-cuda.cpp` `getOptixCoopVecComponentTypeName`) coopvec-component mappers would hit `SLANG_UNEXPECTED` on a new `BFloat16` enumerator, so I instructed the fixer to add BFloat16 mapper cases to both.

**The fixer, working at a later HEAD (`6a009a7f97`), pushed back** with a measured contradiction: both paths already diagnose BFloat16 gracefully (SPIR-V has a pre-staged `== SLANG_SCALAR_TYPE_BFLOAT16` short-circuit → `UnsupportedTargetIntrinsic` BEFORE the mapper's default; CUDA returns an empty slice checked by all callers), AND `SpvComponentType` in the vendored SPIR-V headers has no BFloat16 constant at all — so a real SPIR-V mapping is *impossible* without an upstream spec change. My instruction would have had them write dead code or fabricate a nonexistent constant.

**I verified all three claims from source via a read-only subagent before accepting** — all CONFIRMED — then retracted the instruction.

**Lessons:**
1. **A triage memo's `file:line` findings are HEAD-relative and decay.** A memo written days earlier can be flatly wrong about current source. When it drives an *instruction to add code*, re-verify the target sites at the fixer's actual HEAD first — don't dispatch from the stale memo.
2. **When a downstream agent reverses your specific instruction with a fresh reading, neither accept nor reject from memory.** Spawn a read-only verification against current source. Here it saved shipping dead/fabricated code.
3. **A "add the missing mapper case" instruction has a hidden precondition: that a real mapping exists.** For target-independent-looking enums, check whether the target's own API/header even defines the value — a graceful `diagnose`+return is the *correct* handling for a genuinely target-unsupported value, not a gap to fill.
4. **Correct the memo in place** (strike the wrong finding with the verifying HEAD + date) so the next session isn't misdirected.
