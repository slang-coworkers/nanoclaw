---
title: "slang #9382 Gather ConstOffset — naive fix unsafe; two stale draft PRs exist"
type: learning
topic: slang-compiler
source: learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md
---

# slang #9382 Gather ConstOffset — naive fix unsafe; two stale draft PRs exist

**Issue:** shader-slang/slang#9382 — `Texture2D.Gather(s,uv,int2(2,1))` (constant offset) emits SPIR-V `Offset`(+`OpCapability ImageGatherExtended`) instead of `ConstOffset`(no cap). Reproduces at HEAD (2026-06-17). Pure compile-to-spirv-asm repro, no GPU: `slangc x.slang -target spirv-asm -O0`. Note: at -O1 spirv-opt fixes the *operand* Offset→ConstOffset but the capability declaration LINGERS — so "let spirv-opt handle it" is insufficient.

**Root cause:** core-module `spirv_asm` block `__texture_gather_offset` in source/slang/hlsl.meta.slang (~4007-4013 / 4062-4066) hard-codes `OpCapability ImageGatherExtended;` + `Offset $offset` with no constant check.

**KEY GOTCHA — the naive "just switch to ConstOffset in meta.slang" fix is UNSAFE.** Merged PR #5426 (Closes #5339) deliberately chose `Offset` because GLSL `textureGatherOffset` (glsl.meta.slang:4074/4098) uniquely allows a RUNTIME offset and routes through this SAME intrinsic (it just calls `sampler.Gather/GatherCmp`). Forcing ConstOffset on a runtime value = invalid SPIR-V ("Expected Image Operand ConstOffset to be a const object", the #5339 CTS error). The fix MUST branch on offset constness: ConstOffset(+no cap) for constants, Offset(+cap) for runtime. Both prior PRs chose a conditional approach — corroboration.

**Existing work (check before fixing!):** TWO stale (2026-02-26), CONFLICTING draft PRs already target #9382: **#9741 = jkwak-work's OWN** (IR-legalize pass `processImageGatherOffset` in slang-ir-spirv-legalize.cpp — the principled layer) and **#9410** (copilot, emit-time slang-emit-spirv.cpp). When a maintainer asks to "make a PR" but has their own stale draft, recommend reviving/superseding it rather than opening a redundant 3rd, and give them the opt-out to finish their own.

**General lesson:** for any SPIR-V image-operand capability bug, always check whether the GLSL-source path can feed a runtime value through the same core-module intrinsic before assuming the operand is always constant.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md`_
