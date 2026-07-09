---
title: "slang SPIR-V DebugFunction scope uses one module-global slot pinned to entry-point CU (#11983)"
type: learning
topic: slang-compiler
source: learnings/1783465931766-slang-spir-v-debugfunction-scope-uses-one-module-g.md
---

# slang SPIR-V DebugFunction scope uses one module-global slot pinned to entry-point CU (#11983)

**Symptom:** With `slangc -target spirv -g2` + `import`, imported functions' `DebugFunction` records get the ENTRY-POINT file's `DebugCompilationUnit` as parent scope instead of the imported module's own CU. Valid SPIR-V, runs fine — debugger/tooling-only, no miscompile. (shader-slang/slang#11983, low/P3.)

**Root cause (source/slang/slang-emit-spirv.cpp):** `DebugFunction` scope is NOT stored on the IR inst — `IRDebugFunction` (slang-ir-insts.h:2713) has operands name/line/col/file/debugType only, NO scope/CU operand. Scope is derived at emit time by `findDebugScope` (~line 610), which for a global DebugFunction walks up to `IRModuleInst` and returns a SINGLE module-global scope slot `m_mapIRInstToSpvDebugInst[moduleInst]`. A post-pass (~line 11946, added by PR #10907 fixing #10906, blame b0d4ffe41 zangold-nv 2026-04-27) UNCONDITIONALLY pins that one slot to the entry-point file's CU (m_defaultDebugSource forced to entry-point source ~line 11928). That fixes main-file funcs but drags imported funcs to the wrong CU. Each DebugFunction's *source* operand (getFile(), operand 3) is already correct — only the derived scope operand is wrong.

**Recommended fix (Approach A):** build a `DebugSource → CU` SpvInst map as CUs are emitted (kIROp_DebugCompilationUnit case ~line 2225) and resolve `scope = cuForSource[debugFunc->getFile()]` in `emitDebugFunction`, falling back to the module slot only when a file has no CU. Fixes at the layer that already holds per-function source; no IR/ABI change. Approach B (add explicit CU operand to IRDebugFunction) is more canonical but IR-shape/serialization blast radius. Do NOT just delete the override (Approach C) — re-breaks #10906.

**Sibling:** #11982 (same author, same import path) = duplicate DebugSource records; a shared DebugSource→CU map likely serves both — fix together.

**Repro without GPU:** `spirv-asm` disassembly needs slang-glslang, present only in `build/Debug/lib`, so: `LD_LIBRARY_PATH=build/Debug/lib ./build/Debug/bin/slangc tests/spirv/debug-global-variable-source-import.slang -target spirv-asm -g2 -O0`. The Release binary fails with "failed to load downstream compiler 'spirv-dis'" because no glslang lib sits next to it.

**Meta:** the debug-info emission path in slang-emit-spirv.cpp (findDebugScope, DebugCompilationUnit registration, the scope-override, emitDebugFunction) was byte-identical across g5230a81f2..33f9ed0ce, so an older prebuilt binary gave a ToT-faithful repro — verify with `git diff <old>..<HEAD> -- <file>` before claiming "reproduces on ToT" when the binary lags HEAD.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783465931766-slang-spir-v-debugfunction-scope-uses-one-module-g.md`_
