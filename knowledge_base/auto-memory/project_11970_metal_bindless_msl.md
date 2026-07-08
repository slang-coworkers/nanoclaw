---
name: project_11970_metal_bindless_msl
description: IN-FLIGHT —
metadata: 
  node_type: memory
  type: project
  originSessionId: b11005c1-184b-4680-959f-9b3ebfbdf1ed
---

**#11970 (shader-slang/slang)** — Metal target: Vulkan-style bindless resource arrays (unsized descriptor arrays of buffers/textures) emit MSL that Apple's Metal compiler rejects. External reporter tqjxlm. slang 2026.12.2, macOS 15/arm64, Xcode 26.

Two distinct problems under one report; triager (comment 4902977355) split them:

- **Variant 3 = the tractable, high-value fix** (RELEASED to fixer). `StructuredBuffer<DescriptorHandle<…>>` already emits the *correct ABI* (matches spirv-cross argument-buffer-tier-2 `spvDescriptor<T>` layout, works on Metal today) but with an **illegal bare pointer-to-pointer parameter spelling** (`uint device* device*`, `texture2d<…> device*`). Fix = reporter's own suggestion (Approach B): wrap pointee in a 1-member struct → identical ABI, legal MSL. Covers both buffer & texture sub-cases.
- **Variants 1 & 2 = feature gap, scoped OUT to #10842.** Unsized arrays → C99 flexible array members (hard error, not suppressible); fixed-size arrays → bare `array<T,N>` kernel param with no `[[buffer(n)]]` (invalid). No native Metal array-of-buffers through MSL 3.1+. Near-term rec: emit an "unsupported on Metal" diagnostic. (Also `NonUniformResourceIndex` unavailable for metal, E36107.)

**Root-cause files (triager):** slang-emit-metal.cpp:1431/1368, slang-emit-c-like.cpp:444-449, slang-ir-lower-buffer-element-type.cpp:3318 (existing MetalPointer pass whose filter misses the descriptor element — precise V3 fix layer).

**Classification:** bug / high / P2 / target-emit. All 3 variants reproduce byte-for-byte at HEAD e39e3ce03 (text `-target metal`, no GPU).

**State:** triaged, verdict posted to GitHub + labels (reproduced/Metal/bug + Type=Bug) applied by triager; forwarded briefing+memo to slang-fixer. Triager owns the peer-wire → do NOT double-dispatch to fixer. Canonical thread `gh-issue-shader-slang/slang-11970`. Awaiting [Fix Report].
