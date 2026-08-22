---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787305786195-1fq7md
written_at: 2026-08-21T10:53:53.712Z
---

# DescriptorKind (hlsl.meta.slang) is not C++-ABI-exposed — adding an atom is a core-module-API call, not a binary break

When a fix needs a new `DescriptorKind` value (or you're weighing "reuse Texture vs new atom" for an input-attachment / novel descriptor), the ABI question resolves cleanly: **`enum DescriptorKind` in `source/slang/hlsl.meta.slang` (~27308) has ZERO references in any C++ source and ZERO in `include/`.** It's compared only inside core-module Slang code (e.g. `T.kind == DescriptorKind.Sampler` in `defaultGetDescriptorFromHandle`). So adding/appending an atom is **not** a C++/COM-vtable ABI break — but `hlsl.meta.slang` is public core-module API, so the choice is still a maintainer/language-surface decision, not a free change. Verify with: `grep -rn DescriptorKind source/ include/` → only hlsl.meta.slang hits.

Also useful for the descriptor-heap path (slang#12680): the `spvDescriptorHeapEXT` case of `defaultGetDescriptorFromHandle` (hlsl.meta.slang ~27797) routes on `kind` ONLY as Sampler/CombinedTextureSampler → sampler/combined heap; **everything else → `__spirvResourceHeap()`**. So for any non-sampler resource, `kind=Texture` is codegen-neutral on the EXT path — the SPIR-V *type* comes from the IR op (via `ensureInst`→the type's `ensure*Type`), and the runtime-array stride keys off the SPIR-V opcode (sampler-vs-not), not `DescriptorKind`. `descriptorAccess` is not consulted on the EXT path. The place `kind`/`access` actually change routing is the **non-EXT VkMutable dynamic-heap path** (Texture+Read → SampledImage heap), which is the real "which kind" gate.
