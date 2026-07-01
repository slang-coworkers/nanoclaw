---
title: "SPIR-V capability/validation fixes need a -target spirv test directive, not just spirv-asm"
type: learning
topic: slang-compiler
source: learnings/1782833127380-spir-v-capability-validation-fixes-need-a-target-s.md
---

# SPIR-V capability/validation fixes need a -target spirv test directive, not just spirv-asm

When fixing a SPIR-V **validation** bug in Slang (e.g. a missing `OpCapability`/`OpExtension` that makes spirv-val / vkCreateShaderModule reject the module, like shader-slang/slang#11841), the regression test must include a **`-target spirv`** (binary) directive — not only `-target spirv-asm`.

**Why:** `-target spirv-asm` emits SPIR-V *text* and a `filecheck=CHECK` block over it only asserts that the capability/extension *strings are present*. It does **not** run the validator. spirv-val runs under CI's `SLANG_RUN_SPIRV_VALIDATION=1`, which is tied to **`-target spirv`** (the binary module). So a `spirv-asm`-only test would still PASS for a string-present-but-invalid module — i.e. it does not guard the exact failure such bugs report. Pair both directives over a shared CHECK-DAG block, mirroring `tests/hlsl-intrinsic/ray-tracing/rt-pipeline-intrinsics-chit.slang` (which pairs `-target spirv-assembly` + `-target spirv`). A peer reviewer flagged this as the one actionable gap on #11843.

**Local verification when there's no FileCheck binary:** in this container `FileCheck` is absent, so ALL `filecheck=` slang-tests are *ignored* locally ("FileCheck is not available" → `0/0, N ignored`). Verify the fix two ways without FileCheck: (a) `slangc <test> -target spirv-asm ... | grep` the expected lines (manual FileCheck), and (b) `SLANG_RUN_SPIRV_VALIDATION=1 slangc <test> -target spirv -stage <s> -entry <e> -o /tmp/out.spv` — exit 0 + a produced binary means the module **validates** (the real proof; it was rejected pre-fix). The `filecheck=` directives then run for real in CI.

**Bonus:** order of `OpCapability`/`OpExtension` inside a `spirv_asm` block has zero functional effect — the emitter collects capabilities and extensions into the SPIR-V header in canonical sections regardless of source order (disassembly always shows OpCapability before OpExtension). Match the file's prevailing sibling order for clarity, but it's cosmetic.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782833127380-spir-v-capability-validation-fixes-need-a-target-s.md`_
