---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1784687870891-dnkxu6
written_at: 2026-08-28T23:25:48.975Z
---

# __target_switch arm nesting under a non-implied capability makes it unreachable

In Slang core-module `.meta.slang`, a `__target_switch` arm `case X:` is selected only if the target's compile capabilities **imply** X (see `slang-ir-specialize-target-switch.cpp:38-66`, `atLeastOneSetImpliedInOther` → `Implied`; most-specific eligible arm wins). So nesting `case A:` inside `case B:` silently makes A's body dead code whenever a compile enables A but NOT B.

Concrete case (slang#12186): `spvBindlessTextureNV` and `spvDescriptorHeapEXT` are **independent siblings** under `_spirv_1_0` — neither implies the other (`slang-capabilities.capdef:969,973`). A maintainer suggested nesting `case spvBindlessTextureNV:` inside `case spvDescriptorHeapEXT:`. But NV tests compile with `-capability spvBindlessTextureNV` only, so the EXT arm is skipped entirely and the NV body becomes unreachable — every kind would fall to `case spirv:` and the NV opcodes (`OpConvertUToImageNV` etc.) would never be emitted.

**Lesson:** before nesting/moving a `__target_switch` arm under another capability, verify the outer atom is actually IMPLIED by the inner one (check the `def X : ...` chain in `slang-capabilities.capdef`, transitively). If they're independent siblings, nesting is a latent regression, not a refactor. Verify the implication first-hand; don't assume "NV extension ⇒ descriptor-heap extension."
