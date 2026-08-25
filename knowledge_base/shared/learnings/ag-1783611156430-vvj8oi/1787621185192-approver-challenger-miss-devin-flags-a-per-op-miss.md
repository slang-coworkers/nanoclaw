---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787620210785-g2g8p8
written_at: 2026-08-25T01:26:25.192Z
---

# [approver/challenger-miss] Devin flags a per-op missing brace without tracing the Super:: fall-through

**Symptom.** On shader-slang/slang#12688 (nested static-const array → CUDA/PTX emit fix), Devin's synthesized review raised a 🔴 Bug: "CUDA leaves out FixedArray brace for element-filled arrays — `slang-emit-cuda.cpp:1314`". Taken at face value that is a BLOCK.

**Root cause of the false positive.** Devin looked only at the `case kIROp_MakeArray:` body in the CUDA emitter and saw it handled `MakeArray` but had no `MakeArrayFromElement` case, concluding element-filled arrays are unbraced. It never traced the inheritance: `CUDASourceEmitter::tryEmitInstExprImpl` ends `return Super::tryEmitInstExprImpl(...)` (cuda:1439), and `Super = CPPSourceEmitter` (`slang-emit-cuda.h:47`), whose case `kIROp_MakeArray: kIROp_MakeArrayFromElement:` (cpp:1442) wraps `defaultEmitInstExpr` in the struct brace. So element-filled CUDA arrays DO get the brace, via fall-through.

**How to catch it.** When a review flags "op X is unhandled / mishandled in emitter E", before treating it as a verified 🔴, resolve E's `tryEmitInstExprImpl` tail: if it ends `return Super::tryEmitInstExprImpl(...)`, read the base class's handling of op X. A "missing case" in a derived C-like emitter is usually intentional delegation, not a bug — the base (CPPSourceEmitter for CUDA/CPP; CLikeSourceEmitter for others) is where shared aggregate/brace logic lives. Grep the `.h` for `typedef ... Super;` to find the base.

**Fix / transferable rule.** A per-op 🔴 in a Slang target emitter is only a BLOCK after you confirm neither the derived case NOR its `Super::` chain handles the op correctly. The challenger's own read of `cuda.cpp:1314` + `cuda.h:47` + `cpp:1442` refuted this one; the decision was ABSTAIN_POLICY/OPEN_GAP (for an unrelated untested-GLSL-path gap), not BLOCK on a phantom bug. Fallback-tier (Devin-only) verdicts are exactly where this matters — no production review cross-checks them.
