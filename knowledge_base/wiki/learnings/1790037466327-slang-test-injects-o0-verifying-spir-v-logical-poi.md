---
title: "slang-test injects -O0; verifying SPIR-V logical-pointer fixes needs explicit -O1 + a current spirv-val"
type: learning
topic: slang-compiler
source: learnings/1790037466327-slang-test-injects-o0-verifying-spir-v-logical-poi.md
---

# slang-test injects -O0; verifying SPIR-V logical-pointer fixes needs explicit -O1 + a current spirv-val

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790017171938-etva7e
written_at: 2026-09-22T00:37:46.327Z
---

# slang-test injects -O0; verifying SPIR-V logical-pointer fixes needs explicit -O1 + a current spirv-val

When fixing a SPIR-V emit bug where the illegal instruction is introduced by the **downstream SPIRV-Tools optimizer** (e.g. SROA turning a whole-aggregate copy into `OpCompositeConstruct`), be careful how you verify — two traps cost real time on shader-slang/slang#13206:

1. **`slang-test` compiles at `-O0` when a test directive gives no opt level.** A `//TEST:SIMPLE(filecheck=CHECK):... -emit-spirv-directly` with `CHECK-NOT: OpCompositeConstruct` therefore does NOT exercise the optimizer at all — the composite only appears at `-O1`/default, so an `-O0`-only check is a false green. Pass an explicit `-O1` on the SIMPLE directive (and `-Xslang -O1` on a COMPARE_COMPUTE) to cover the path where the bug actually manifests. (Confirmed via `slang-test -v`.)

2. **The pinned in-tree `spirv-val` (external/slang-binaries, v2024.2) predates `validate_logical_pointers.cpp`** and does NOT flag "Instruction may not have a logical pointer operand." So `SLANG_RUN_SPIRV_VALIDATION=1` returning rc 0 does not prove the artifact is valid on the validator the reporter used. Verify directly by grepping the emitted asm for `OpCompositeConstruct`/`OpCompositeExtract` whose type is a logical pointer (e.g. `%_ptr_Workgroup_*`), not only by exit code.

3. **`SLANG_RUN_SPIRV_VALIDATION` validates Slang's pre-optimizer module**, not the final optimized binary. A fix that only cleans Slang's own emission can still ship an invalid final artifact once spirv-opt runs. Check the emitted asm at the optimization level the user hits.

Bonus: a diagnostic message using `~inst:IRInst` renders `''` for anonymous IR insts (fieldExtract/getElement). Drop the interpolation (the location + caret already point at the site); the `~inst:IRInst` token is what generates the struct's `inst` field, so also change the call site to `Diagnostics::Foo{.location = inst->sourceLoc}`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790037466327-slang-test-injects-o0-verifying-spir-v-logical-poi.md`_
