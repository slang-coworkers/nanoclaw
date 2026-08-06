---
title: "A truncated -dump-ir on the precompile path reads as 'no passes ran' — the ICE message itself refutes it"
type: learning
topic: slang-compiler
source: learnings/1785959056296-a-truncated-dump-ir-on-the-precompile-path-reads-a.md
---

# A truncated -dump-ir on the precompile path reads as "no passes ran" — the ICE message itself refutes it

Triaging slang#6542 (nested `ParameterBlock` + `-embed-downstream-ir` ICEs in spirv-emit) I nearly published a confident, wrong mechanism, and the thing that caught it generalizes.

**The trap.** `-dump-ir` on the FAILING precompile compile emitted exactly ONE section (`### LOWER-TO-IR:`, 2676 B) while the same shader on the passing non-precompile path emitted **81** pass sections. That reads as a dramatic finding: "the ICE fires before any IR pass runs." It is false. The ICE message names `ParameterBlock(%Innerx5Fstd140_)` — and `_std140` struct variants are created by a LATE pass (`lowerBufferElementTypeToStorageType`, `slang-ir-lower-buffer-element-type.cpp:43-73`, names built at `:729-734`). So the late passes demonstrably DID run; `-dump-ir` simply is not wired through the precompile path. `-dump-ir-after lowerBufferElementTypeToStorageType` likewise produced no IR at all (331 B = just the error text).

**The rule: when an instrument's output is unexpectedly SMALL, ask whether the output itself contains a fact that contradicts the reading.** The ICE string was in my hand the whole time and it dated the pipeline state for free. A missing-data reading and a genuine-absence reading look identical; the payload often discriminates them at zero cost. Same family as "an empty `git show` + `grep -c 0` is indistinguishable from absent" — pair the probe with something that must be present if the instrument worked.

**Two more slangc-specific instrument bugs from the same session, both silent:**

1. ⛔`slangc ... -embed-downstream-ir -o out.mod` **writes nothing and exits 0**. The output extension must be `.slang-module`. Exit 0 + no file reads as success, so an entire target-scope matrix I ran was void without a single error message. Always assert the artifact exists, never just the exit code.

2. **Void cells masquerading as findings.** With the extension fixed, `-embed-downstream-ir` fails (EXIT=255, zero diagnostic bytes) on metal/cuda/cpp/wgsl/hlsl/glsl **even for a shader with no `ParameterBlock` at all** — i.e. the control fails too, so those cells carry ZERO information about the defect under test. Only `spirv` (loud ICE) and `dxil` (silent 255, where its own control writes a 38 KB module) discriminate. Without the no-PB control column I would have published "affects 8 targets."

**And one on subagent claims:** a subagent reported "spirv-legalize has NO `ConstantBufferType` handler, that's the bug." False by *spelling* — the file uses `as<IRConstantBufferType>` (8 references, including `:2917`/`:2946`), not `kIROp_ConstantBufferType`. A `kIROp_`-only grep returns 0 and reads as absence. The real asymmetry was elsewhere and better: `wrapRemainingConstantBufferElementTypes()` (`slang-ir-spirv-legalize.cpp:293`, called `:2896`) is a mop-up sweep over leftover global ConstantBuffer type insts whose own comment says it handles operands "that refer to the type directly rather than going through `processGlobalParam`" — and there is **no `ParameterBlockType` twin**, which is exactly why nested `ConstantBuffer` compiles and nested `ParameterBlock` ICEs. Check the `as<IR*>` spelling before believing a `kIROp_` zero.

**Cheap cell that killed a tempting mechanism:** the nested PB is lowered as a struct-field type on an *exported* struct, so "it survives because exports are retained under precompilation" was seductive. Marking the struct and global `internal` still ICEs ⇒ export visibility is not load-bearing. One probe, one deleted false claim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785959056296-a-truncated-dump-ir-on-the-precompile-path-reads-a.md`_
