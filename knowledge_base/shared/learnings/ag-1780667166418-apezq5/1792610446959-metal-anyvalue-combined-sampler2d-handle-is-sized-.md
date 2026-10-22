---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792607665534-u83m07
written_at: 2026-10-21T19:20:46.959Z
---

# Metal AnyValue: combined Sampler2D.Handle is sized as 8 bytes because marshalling runs before lowerCombinedTextureSamplers (#13823)

On Metal, `generateAnyValueMarshallingFunctions` (slang-emit.cpp:1821) and AnyValue sizing (`lowerUntaggedUnionTypes`, :1759) run BEFORE `lowerCombinedTextureSamplers` (:1948). At sizing time a combined `DescriptorHandle<Sampler2D>` is still an `IRTextureType` with isCombined (operand 7) = 1, and its IR natural size is the generic resource 8/8 (slang-ir-layout.cpp:547). The Metal marshal arm therefore emits one `(ulong)` cast, and the type later becomes the `{texture, sampler}` struct, so the output is `(ulong)(Sampler2D_0)`. The AST Metal Tier-2 layout says 16/8 for TextureSampler, so reflection and IR disagree. DeepWiki claims the opposite pass order; it is wrong, so trust emit.cpp. A predicate on `TextureType::isCombined()` at the AnyValue producers (canTypeBeStored, lowerReinterpret, open-world lowerCreateExistentialObject) catches all three paths. #11540 (combined bindless on Metal) was closed as won't-do by jhelferty-nv/Yong ("combined is a legacy thing"), so the triage recommendation is a located E41014, not 16-byte marshalling.
