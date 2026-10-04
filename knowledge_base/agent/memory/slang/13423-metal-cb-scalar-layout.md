---
type: chain
title: slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout / -fvk-use-scalar-layout
description: Triaged + reproduced, enhancement P2, not a regression (#11578 kept Metal CBs native on purpose). GO on Approach A (explicit ScalarDataLayout only) via the triager 2026-10-03
---

# slang#13423 (external reporter mellinoe, 2026-10-03)

**Triage (slang-triager, comment 5972827172, master `6ba151dcf`):** on Metal,
`getTypeLayoutRuleNameForBuffer` returns `Natural` (lower-buffer-element-type.cpp:2416-2417) before it reads
the CB's `L` operand. `usesPackedVectorStorage` (:2991-3003) packs only StorageBuffer/UserPointer.
Reflection `MetalLayoutRulesFamilyImpl::getConstantBufferRules` (type-layout.cpp:2799) ignores both.
Emitted MSL and reflection agree (`cb.B`@16, `sb.B`@12), so this is an ignored request, not a miscompile.
The origin is #11578 (fknfilewalker, merged 2026-06-13), which deliberately kept CBs, argument buffers and PBs native.
Sampled v2025.17 through v2026.19: all emit `float3`.

## Decision (mine)
- 10-03 ~19:50Z: **GO on Approach A, through the triager** (precedent #13409: external reporter, no assignee,
  no maintainer routing). Scope: honor an explicit `ConstantBuffer<T, ScalarDataLayout>` on Metal in IR and
  reflection together, Tier-2 argument-buffer rules included, plus a regression test. Default CB/cbuffer/PB/EP
  uniforms stay byte-identical. **A' (`-fvk-use-scalar-layout` changing the default Metal CB) is NOT implemented**; it goes in the
  PR as a design question for maintainers (cbuffer-vector-native-layout.slang pins native). Approach B (diagnostic) is
  out of scope.
- Overlap: draft bot PR #13300 (`feat/layout-rules-version`, last updated 10-01) touches
  lower-buffer-element-type.cpp, type-layout.cpp, ir-layout. Instruction: don't touch #13300's branch, keep the
  shared-file diff minimal, and whichever PR lands second rebases.
- 10-03 23:00Z: the triager amended the GO, and I accept the amendment. (1) **Tier-2 :2869 is dropped.**
  `MetalArgumentBufferTier2LayoutRulesFamilyImpl::getConstantBufferRules` is reachable only from :3076, which
  passes `containerType=nullptr`. All `kMetalTier2*LayoutRulesImpl_` point at `kMetalLayoutRulesFamilyImpl`
  (:2765 etc.), so nested CBs route through Tier-1 :2799 via :4328. **I verified this at `6ba151dcfc`.** Tier-2 is covered by a
  `getTypeLayout(…, MetalArgumentBufferTier2)` unit test instead. (2) `MetalConstantBuffer` gets real Metal-native IR
  rules and keeps the "natural" name hint, so default MSL stays byte-identical. (3) The Metal-only EP-uniforms guard
  stays, because without it `-fvk-use-scalar-layout` would pack IR while reflection stays native, which is a miscompile.
  The fixer is building in `wt-slang-13423`; nothing is pushed yet.

## Resumes on
The fixer's draft PR / report; a human comment on #13423; any maintainer objection on the #11578 design.
