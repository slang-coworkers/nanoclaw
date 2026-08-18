---
title: "fvk-bind-globals non-default set collides split-out globals resources onto CB binding (slang#10668)"
type: learning
topic: slang-compiler
source: learnings/1784754402921-fvk-bind-globals-non-default-set-collides-split-ou.md
---

# fvk-bind-globals non-default set collides split-out globals resources onto CB binding (slang#10668)

**Bug (shader-slang/slang#10668, reproduced on ToT g3649fb982):** With `-fvk-bind-globals <binding> <set>` where set != 0, a resource (sampler/texture) split out of the module-scope `uniform` globals struct is placed at the SAME (set, binding) as the `$Globals` UBO instead of globals-binding+1 → descriptor conflict.

**Empirical ground truth** (via `slangc -target spirv-asm ... -emit-spirv-directly`, grep `OpDecorate ... Binding/DescriptorSet`):
- default / `-fvk-bind-globals 0 0`: UBO=(set0,b0), sampler=(set0,**b1**) ✅
- `-fvk-bind-globals 0 1`: UBO=(set1,b0), sampler=(set1,**b0**) ❌ conflict
- `-fvk-bind-globals 3 2`: both=(set2,b3) ❌ conflict
So the trigger is the `-fvk-bind-globals` reservation path for ANY non-default set, NOT `set==1`.

**Root cause (code, slang-parameter-binding.cpp @ d384b77e6):** default path uses `_allocateConstantBufferBinding` (3255) → allocates CB from `defaultSpace` on the SAME range-set/kind the split-out sampler later `.Allocate`s from (finite path 1796-1810), so the sampler naturally bumps to +1. The flag path uses `_assignConstantBufferBinding` (3278, called at 4630) which `.Add`s the CB reservation into the globals set — but the split-out resource does NOT go through the shared-bucket bump, so it reuses the CB's index. Fix: reserve globals-binding+1 as low-water mark for split-out globals resources in the specified set (fixer must IR-dump to pin the exact bucket/line). NO test coverage exists (`grep fvk-bind-globals tests/` = empty) — add a `-target spirv-asm` FileCheck (no GPU needed).

**Method lesson:** two subagents produced competing hypotheses about which set the sampler inherits (defaultSpace vs globals set). A 2-minute `emit-spirv-directly` repro settled it as ground truth. When a load-bearing binding/layout claim is disputed and a prebuilt slangc is available, REPRODUCE rather than pick a hypothesis — set `LD_LIBRARY_PATH` to the release-package lib dir if the Debug build lacks `libslang-glslang` for `spirv-asm` disassembly.

**Adjacent prior art:** learning 1782879563848 (single-kind exclusion guards #11860/#11871) — same resource-kind-bucket-mismatch failure family (a resource falsely reusing binding 0).

**Design footnote:** reporter asked whether split-out samplers should instead go to set 0 (DXC SPIR-V example 3). Slang's model = same-set/next-binding; DXC's split-to-set-0 is a separate maintainer semantics decision, NOT the conflict fix.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784754402921-fvk-bind-globals-non-default-set-collides-split-ou.md`_
