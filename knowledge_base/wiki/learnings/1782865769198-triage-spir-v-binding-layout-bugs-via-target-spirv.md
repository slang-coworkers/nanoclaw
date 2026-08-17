---
title: "Triage SPIR-V binding/layout bugs via -target spirv -O0 -reflection-json when glslang downstream is unavailable"
type: learning
topic: slang-compiler
source: learnings/1782865769198-triage-spir-v-binding-layout-bugs-via-target-spirv.md
---

# Triage SPIR-V binding/layout bugs via -target spirv -O0 -reflection-json when glslang downstream is unavailable

When the local slangc env can't load the glslang downstream compiler (`error[E00100]: failed to load downstream compiler 'spirv-opt'/'spirv-dis'`, `failed to load dynamic library 'slang-glslang-*'`), `-target spirv-asm` aborts before writing reflection or emitting layout — so you can't inspect binding/descriptor-set assignments that way.

**Workaround:** use `-target spirv -O0 -o out.spv -reflection-json refl.json`. `-target spirv` (binary, emit-spirv-directly is the default) + `-O0` skips the spirv-opt/spirv-dis invocations that need glslang, so compilation completes (exit 0), any layout diagnostics (e.g. E39012 bindless-space) still fire, and `reflection.json` is written with the actual `{kind, space, index}` bindings and `bindlessSpaceIndex`. This is enough to reproduce and root-cause descriptor-set / binding-allocation bugs locally without a working glslang or GPU.

**Concrete use (issue #11860):** reflection.json showed the input attachment at `{descriptorTableSlot, space:3, index:7}` + `{inputAttachmentIndex, index:5}` (correct) but `"bindlessSpaceIndex": 1` (wrong, requested 0) — pinpointing that descriptor set 0 was being falsely reserved. Root cause: `vk::input_attachment_index` reservation (added by #11712, slang-parameter-binding.cpp:1487) hardcodes `semanticInfo.space=0`, and `addExplicitParameterBinding`'s else-branch `markSpaceUsed(...,space=0)` (:929) marks descriptor set 0 used even though InputAttachmentIndex occupies no descriptor set (it lowers to OpDecorateInputAttachmentIndex only). General lesson: `markSpaceUsed`/`usedSpaces` is descriptor-set-occupancy bookkeeping and must not be invoked for a LayoutResourceKind that doesn't consume a descriptor/register space.

**Empirical discriminator technique:** to prove a specific attribute (not a neighbor) causes a layout bug, compile a variant that drops just that attribute (here: SubpassInput+input_attachment_index → plain Texture2D at same vk::binding). The bindlessSpaceIndex flipping from 1→0 isolated the culprit and turned a code-read hypothesis into a proven root cause.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782865769198-triage-spir-v-binding-layout-bugs-via-target-spirv.md`_
