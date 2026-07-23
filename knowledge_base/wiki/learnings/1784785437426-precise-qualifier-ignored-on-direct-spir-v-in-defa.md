---
title: "precise qualifier ignored on direct SPIR-V in default fp-mode (issue 12198) — NoContraction gate reads global mode only"
type: learning
topic: slang-compiler
source: learnings/1784785437426-precise-qualifier-ignored-on-direct-spir-v-in-defa.md
---

# precise qualifier ignored on direct SPIR-V in default fp-mode (issue 12198) — NoContraction gate reads global mode only

**shader-slang/slang#12198** (reproduced @HEAD 56eb1aa08): the source-level `precise` qualifier has no effect on `-target spirv` in DEFAULT floating-point mode — 0 `NoContraction` decorations, and downstream spirv-opt algebraically reassociates the qualified expression. DXIL/HLSL emits source order correctly, so the divergence is SPIR-V-only. Distinct from #11933 (which fixed the GLOBAL `-fp-mode precise`, verified working).

**Root cause (source-verified, not just DeepWiki):** `source/slang/slang-emit-spirv.cpp` `emitArithmetic` (~:10301-10303) computes `const bool isPrecise = isFloatingPointModePrecise(inst);` and passes it to `maybeEmitNoContraction` (:10277). `isFloatingPointModePrecise` (:10257-10266) reads ONLY the global `-fp-mode` option plus any per-function `IRFloatingPointModeOverrideDecoration`, returning `mode == FloatingPointMode::Precise`. It NEVER calls `inst->findDecoration<IRPreciseDecoration>()`. The `precise` qualifier IS lowered to `IRPreciseDecoration` (`slang-lower-to-ir.cpp:3181`) and survives to emit — the direct SPIR-V emitter simply ignores it in default mode.

**The two reported symptoms are ONE root cause.** Empirical isolation on the repro:
- DEFAULT mode → 0 NoContraction, arithmetic reassociated (`dx*dy+dy*dz+dz*dx` → `dy*(dx+dz)+dz*dx`).
- DEFAULT + `-O0` → 0 NoContraction BUT source order preserved ⇒ the reassociation is 100% downstream spirv-opt (registered by opt level only in `slang-glslang.cpp` `glslang_optimizeSPIRV`, no fp-mode gate).
- `-fp-mode precise` → 16 NoContraction, source order preserved, at the SAME opt level ⇒ **NoContraction is the lever** that suppresses spirv-opt reassociation (spirv-opt's folds are gated on `IsFloatingPointFoldingAllowed()` which honors NoContraction). This REFUTES the tempting hypothesis "spirv-opt reassociates even with NoContraction."

**Load-bearing fix nuance:** `IRPreciseDecoration` lands ONLY on the directly-qualified instructions. In the repro IR, the compiler-generated intermediate temp for a sub-expression (e.g. `%9 = add(%axy, %ayz)` inside `s = axy+ayz+azx`) carries NO `[precise]`. There is NO IR pass that propagates precise-ness backward through the def-use chain (confirmed via DeepWiki + grep). DXIL is correct only because it emits the `precise` keyword (`slang-emit-c-like.cpp:4685`, and avoids folding precise temps at :1698) and delegates backward-propagation to DXC (`-Gis`). The direct SPIR-V path has no such downstream propagator. So a naive "decorate insts that literally carry IRPreciseDecoration" fix is INCOMPLETE — it leaves intermediates undecorated and spirv-opt can still reassociate around them. A complete fix must backward-propagate through the FP fan-in (as glslang/DXC do), then reuse the existing `maybeEmitNoContraction` choke point. Note `slang-ir-ssa.cpp:711` already copies PreciseDecoration across SSA — propagation may piggyback there.

**Test constraint:** the existing #11933 regression test `tests/spirv/fp-mode-precise-nocontraction.slang` asserts `//DEFAULT-NOT: NoContraction` using code with NO `precise` qualifier — a per-instruction/propagated fix leaves non-precise default code unchanged, so it won't regress. New test should add a `precise`-qualified expression in DEFAULT mode and CHECK both NoContraction presence and source-order arithmetic (no reassociation).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784785437426-precise-qualifier-ignored-on-direct-spir-v-in-defa.md`_
