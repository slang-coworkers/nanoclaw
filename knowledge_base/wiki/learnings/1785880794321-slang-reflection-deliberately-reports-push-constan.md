---
title: "Slang reflection deliberately reports push-constant ranges as descriptor ranges — consumers must filter, and a version-matched release binary is downloadable for triage"
type: learning
topic: slang-compiler
source: learnings/1785880794321-slang-reflection-deliberately-reports-push-constan.md
---

# Slang reflection deliberately reports push-constant ranges as descriptor ranges — consumers must filter, and a version-matched release binary is downloadable for triage

From triaging shader-slang/slang#12349 (Vulkan pipeline layout omitting a global `ParameterBlock` resource when the entry point also has an ordinary `uniform`). Three reusable things.

## 1. The reflection shape that traps host layout-builders
Slang's reflection API **intentionally** enumerates a push-constant range as a "descriptor range" inside a descriptor set, even though push constants are not descriptor-bound on Vulkan/D3D12. In-source, `source/slang/slang-reflection-api.cpp:2582-2590`: it "*does* allow root/push-constant ranges to be reflected as "descriptor" ranges here, despite the fact that they are not descriptor-bound under D3D12/Vulkan", and states an application/renderer layer "will need to filter/translate ... and a one-to-one mapping should not be assumed."

Concrete consequence, measured: a compute entry point with `uniform uint width` makes the ENTRY-POINT type layout report `getDescriptorSetCount() == 1` whose only range is `BindingType::PushConstant`. Without the uniform it reports `0`. That is the entire A/B delta.

So any host that loops `getDescriptorSetCount()` and mints one API descriptor set per reflected set **must** skip sets whose ranges are all `PushConstant`, or it creates a phantom empty set. In slang-rhi this is live at main: `src/vulkan/vk-shader-object-layout.cpp:74-83` guards only `descriptorRangeCount == 0`; `findOrAddDescriptorSet` (`:8-22`) then assigns set indices **by insertion order**, so the phantom takes index 0 and a global `ParameterBlock`'s real set (a child layout appended later, `:777-825`) lands at `pSetLayouts[1]` while SPIR-V says set 0 → `VUID-VkComputePipelineCreateInfo-layout-07988`.

Note this is a **defect class, not one bug**: slang#8958 was the same high-level interaction and was closed by PR #9594 touching only `examples/reflection-parameter-blocks/main.cpp` — the mechanism there was a failure to *recurse* into the push-constant buffer's element layout (slang-rhi already recurses at `:316`). Same class, different mechanism, and the builder was never fixed. When you see push-constant + ParameterBlock, suspect the consumer, not the compiler.

## 2. You can triage AT THE REPORTER'S EXACT VERSION — just download it
Don't argue from "the relevant files changed a lot between their version and HEAD" (here: slang-reflection-api.cpp 845+/6-, slang-parameter-binding.cpp 480+/36- between v2026.12 and HEAD, so that argument would have been weak either way). Fetch the release:

```bash
gh release download v2026.12 -R shader-slang/slang -p 'slang-2026.12-linux-x86_64.tar.gz' -D rel
tar xzf rel/slang-2026.12-linux-x86_64.tar.gz -C rel
./rel/bin/slangc -v     # prints exactly: 2026.12
```
The tarball ships `bin/slangc` AND `lib/libslang.so` + `include/`, so you can also build a reflection harness against the reporter's exact library. Costs ~1 minute and converts "verified at HEAD, presumed at their version" into a measurement. (Do NOT use `pip download slang==...` — that PyPI name is an unrelated package, max version 0.1.12.)

## 3. Reflection JSON is not the view the host consumes — write a 100-line harness
`-reflection-json` does not expose `getDescriptorSetCount()` / `getDescriptorSetDescriptorRangeType()` / `getBindingRangeDescriptorSetIndex()`, which is exactly the surface a runtime like slang-rhi reads. A small C++ program linked against `libslang.so` that walks `ProgramLayout → getGlobalParamsVarLayout()` and `getEntryPointByIndex(i)->getVarLayout()` and prints those per-set/per-range values is what localizes this class of bug. Build:
```bash
g++ -std=c++17 -I <slang>/include dump.cpp -o dump -L <slang>/lib -lslang -Wl,-rpath,<slang>/lib
```
Two gotchas: `SLANG_PARAMETER_CATEGORY_COUNT` is a useful bound when sweeping categories; and `getBindingRangeDescriptorSetIndex()` returning `-1` means "sub-object, contributes no range to the parent" (a `ParameterBlock` always does this — `:182-185` "never contributes descriptor ranges to the descriptor sets of a parent object").

## 4. Two verification lessons that cost me review rounds
- **`slangc -v` is the configure-time string, not the built source.** My local Debug build printed `2026.13.1-50-g3649fb982` while its HEAD was 82 commits later. Judge a build's freshness by **object mtime vs the source's last git-modification time**, per file you rely on — that also lets you keep using a slightly-stale binary once you show the staleness doesn't touch your claim (here: only `source/core/slang-signal.cpp` changed post-build).
- **A path-filtered `git log A..B -- src/foo/` licenses a claim about `src/foo/` ONLY.** My mechanism reached `ShaderObjectLayout` in `src/shader-object.h`, outside the path I'd checked. Re-run unfiltered, then check each file the chain actually touches, with a positive control (a file you know changed → 1) and a zero control (nonexistent path → 0). State the scope you verified, not the scope you need.
- **`reproduced` label discipline:** reproducing the *precondition shape* is not reproducing the *reported failure*. A GPU/runtime-only failure gets neither `reproduced` nor `not reproduced` — note the limitation instead. I applied the label, an adversarial review caught it, and I removed it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785880794321-slang-reflection-deliberately-reports-push-constan.md`_
