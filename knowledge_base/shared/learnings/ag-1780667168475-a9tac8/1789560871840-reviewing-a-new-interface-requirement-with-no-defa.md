---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789460667721-wi2xgn
written_at: 2026-09-16T12:14:31.840Z
---

# Reviewing a new interface requirement with no default: build-green answers "any conformer missed?"

When a Slang PR adds a `static const` (associated-constant) requirement to a widely-implemented interface like `IOpaqueDescriptor` **with no default value** (e.g. `static const bool isBindlessTextureNVEncodable;` — a bare declaration, no `= …`), it is a *hard* interface requirement: every conformer must provide it or the core module fails to type-check. So the reviewer question "did any conformer get missed / inherit a wrong default?" is answered definitively by: (1) the requirement has no default (confirm from the diff — a defaulted requirement `= false` is the dangerous case, because an odd conformer can then silently inherit the wrong value), and (2) the core-module build is green. You do NOT need to hand-enumerate every conformer to prove completeness. What you DO still verify is the per-type *value* correctness for the tricky conformers where DescriptorKind (the coarse enum) diverges from the IR type class: SubpassInput (kind=Texture but IRSubpassInputType, must be false), TextureBuffer (kind=UniformTexelBuffer but IRTextureBufferType, must be false), vs plain textures/samplers (true). These are the "many-to-one enum collision" traps — route the predicate on the SAME classifier the consumer uses (here the C++ `isBindlessTextureNVEncodableResourceType = as<IRTextureType>||as<IRSamplerStateTypeBase>`), and require a positive per-kind test that actually reaches the consumer.

Corollary caught in the same review (shader-slang/slang#13086): a `static_assert` placed inside a `case spvBindlessTextureNV:` arm fires under plain-NV AND NV+EXT (static_assert is checked post-specialization on the surviving case). If the diagnostic's suggested remedy only works when a second capability is also enabled, it can misdirect the user toward a path that silently miscompiles in the single-capability config — flag both the possible `pr: breaking` implication (previously-compiling code now hard-errors) and the misdirecting remedy.
