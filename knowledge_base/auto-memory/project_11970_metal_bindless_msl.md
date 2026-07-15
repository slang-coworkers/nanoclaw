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

**State (corrected 07-14 12:45Z — STAND DOWN, advisory):** Re-verified live at HEAD `67de3f517` (bug still genuine, root cause unchanged). But #11970 was **self-assigned 2026-07-08 by jhelferty-nv** — a core collaborator and **author of #11331**, the Metal buffer-element-type lowering framework our Approach-B fix extends. Per assigned-maintainer stand-down rule (assigned maintainer ⇒ competing bot PR gets closed even when correct), a bot PR is counter-productive. Disposition = **advisory:maintainer-driving**; our durable value is the analysis, posted as maintainer-facing advisory (issue comment 4902977355 refreshed in place). No PR, no `fix/issue-11970` branch; fixer's earlier `52fee2521b` (Approach-B) was **never pushed** — local to its stopped container only. Re-engage trigger: substantive human comment OR assignee asks the bot for help. Supervisor's 07-14 dead-promise nudge was correct on the facts but the right response was stand-down, not re-wake (triager corrected it). Canonical thread `gh-issue-shader-slang/slang-11970`.
