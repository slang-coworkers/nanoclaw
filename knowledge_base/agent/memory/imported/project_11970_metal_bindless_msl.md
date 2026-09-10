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

**State (07-28 — RE-ENGAGED, stand-down LIFTED by assignee request):** The 07-14 stand-down (advisory:maintainer-driving, because jhelferty-nv self-assigned + authored #11331) had a documented re-engage trigger: *substantive human comment OR assignee asks the bot for help*. **That trigger fired 07-28** — jhelferty-nv (assignee) posted comment `5098719946` explicitly `@nv-slang-bot`-mentioning and directing the bot to produce **two PRs, keep the issue open until both land**:
  - **PR 1 — Variant 3 (do now):** extend `MetalPointerBufferElementTypeLoweringPolicy` to wrap those StorageBuffer elements in a **one-field struct**. **Keep `IRPtrType → ulong` as-is; do NOT wrap top-level `.Handle` params.** Add metal/metallib tests with indexed access. (Confirms triager's fix layer + our earlier Approach-B patch `52fee2521b`.)
  - **PR 2 — Variants 1–2 (after PR 1 lands; larger scope):** arrays of resource *bindings* (`R[N]`/`R[]`, incl. in `ParameterBlock`) — a real Metal binding-array/argument-buffer lowering, **or diagnose until that exists**. NOT a silent desugar to `DescriptorHandle`.
  Maintainer's split matches the triager's split exactly → this is re-engage-the-fixer, NOT re-triage. Routed to **slang-triager** on canonical thread to lift stand-down + re-dispatch fixer through its existing peer-wire (avoids giving fixer two parents). **Drafts-only guardrail applies:** fixer produces DRAFT PRs; "land"=merge is maintainer/operator-gated (assignee may flip ready/merge on their own side). Canonical thread `gh-issue-shader-slang/slang-11970`.

**Prior state (07-14 12:45Z — STAND DOWN, superseded above):** Re-verified live at HEAD `67de3f517` (bug genuine, root cause unchanged). #11970 self-assigned 2026-07-08 by jhelferty-nv (core collaborator, author of #11331). Under the assigned-maintainer stand-down rule a competing bot PR gets closed even when correct → disposition was advisory:maintainer-driving; durable value = analysis posted as maintainer-facing advisory (issue comment 4902977355). Fixer's `52fee2521b` (Approach-B) was never pushed — local to its stopped container. Supervisor's 07-14 dead-promise nudge was correct on facts but the right response was stand-down, not re-wake (triager corrected it).
