---
title: "Slang: flipping default -g exposes a masked strip-condition gap → VM crashes + textual codegen churn"
type: learning
topic: slang-compiler
source: learnings/1784443743816-slang-flipping-default-g-exposes-a-masked-strip-co.md
---

# Slang: flipping default -g exposes a masked strip-condition gap → VM crashes + textual codegen churn

**Context:** slang#11682 fix flips the DEFAULT `-g` level `None`→`Minimal`. This exposed a latent gap that `default==None` had been silently masking.

**The masked gap (verified @HEAD 203065d66):** `slang-emit.cpp:~1027-1031` strips debug info with:
```cpp
// Debug info is added by the front-end. If the target cannot express debug info, or if the user
// specifies -g0, we need to stripped them out now to allow more optimization and cleanups.
if (requiredLoweringPassSet.debugInfo &&
    (targetCompilerOptions.getDebugInfoLevel() == DebugInfoLevel::None))
    SLANG_PASS(stripDebugInfo);
```
The **comment states two conditions** ("target cannot express debug info" OR "-g0") but the **code implements only one** (`== None`). While the default level was `None`, every default compile hit the strip anyway, so the missing "debug-incapable target" arm never mattered. Once the default becomes Minimal, debug insts (`IRDebugLine`) survive into targets that can't consume them.

**Two failure classes it produced (both root-caused to this one gap):**
1. **19 slangi/INTERPRET (VM bytecode) HARD CRASHES** — `slang-emit-vm.cpp:~1174` `default: SLANG_UNIMPLEMENTED_X("VM bytecode gen for inst.")`. The VM emitter's switch has no debug-inst cases and the VM path never strips, so `IRDebugLine` falls through and aborts. This is a real regression, not golden churn.
2. **~32 textual HLSL/GLSL/Metal/CUDA golden diffs** — `#line`/temporaries from folding suppression (see the sibling learning on -g→textual codegen). The C-like emitter already `break;`s on debug ops (`slang-emit-c-like.cpp:~3229`), so once the insts are stripped upstream the output reverts.

**Principled fix:** extend the strip condition to also fire for debug-incapable targets. The RIGHT predicate is `!isSPIRV && !isCPUTargetViaLLVM` — NOT a bare `!isSPIRV`. CPU-via-LLVM genuinely CAN express debug info (DWARF), so a bare `!isSPIRV` would wrongly strip it. Both predicates already exist in-tree; no hardcoded target list.

**Lessons:** (1) A default enum value can MASK a code-vs-comment gap for years; changing the default is exactly when such gaps surface — grep the comment against the condition. (2) When authorizing a "strip for incapable targets" condition, enumerate WHICH targets are actually incapable — SPIR-V and CPU/LLVM both consume debug info; only textual + VM/bytecode don't. (3) A hard `SLANG_UNIMPLEMENTED` default arm in an emitter switch means any newly-surviving inst class becomes a crash, not a graceful skip — flipping a front-end default can weaponize it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784443743816-slang-flipping-default-g-exposes-a-masked-strip-co.md`_
