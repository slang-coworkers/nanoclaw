---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789440891439-qb8042
written_at: 2026-09-18T17:51:52.256Z
---

# Slang type-modifier coercion is the reusable hook for add/drop policy; coherence is access-based (proposal 031)

When a triage/design question asks "should modifier X be add/droppable during conversion, implicitly or explicitly?" (e.g. #13084 making `globallycoherent` a type modifier), the machinery already exists — don't propose it as net-new:

- **Type modifiers** = `ModifiedType` (slang-ast-type.h:1364) wrapping a base type + `TypeModifierVal` subclasses (`UNormModifierVal`/`SNormModifierVal`/`NoDiffModifierVal`, slang-ast-val.h:1185-1213). Parser routes them onto the type via `_moveTypeModifiersToTypeExpr` (slang-parser.cpp:3340). Modifier survives to IR as an `IRAttributedType` attr (`visitModifiedType` slang-lower-to-ir.cpp:3013). **No public-ABI surface** — reflection peels it via `unwrapModifiedType`.
- **`coerce` already owns the add/drop policy**: `_coerce` modifier block (slang-check-conversion.cpp:1940-2036) calls `_canModifierBeAddedDuringCoercion` (:1572) / `_canModifierBeDroppedDuringCoercion` (:1596) per modifier, then wraps via `createModifierCast` (:3372). unorm/snorm return true both ways (freely implicit). Neither helper consults `CoercionSite` today, but it's available — so "explicit-only drop" = return false for implicit + let the `CoercionSite::ExplicitCoercion` path (→ ExplicitCastExpr, :2231/:2278) permit it; a ~1-param thread.

- **Coherence is access-based, not type-based, in Slang today** — for BOTH pointers and resources. Resources: `globallycoherent`→`MemoryQualifierSetModifier`→`IRMemoryQualifierSetDecoration` on the resource var; the coherent-ness of each load/store is decided per-access at emit by `NeedToUseCoherentLoadOrStore` (slang-emit-spirv.cpp:1740) walking the access back to the var. Pointers: the team **deliberately chose per-operation coherence** (`loadCoherent`/`storeCoherent` carrying `IRMemoryScopeAttr`) over type-baking and **explicitly banned `Ptr<coherent T>`** — see `external/spec/proposals/031-coherent-pointer-operations-and-access.md` (alternatives §2/§4/§5 = type-modifier variants, all rejected). So proposing coherence-as-type-modifier for resources runs opposite to that decision.

- **Target fulfillability of coherence**: declaration-based on HLSL/GLSL/SPIR-V-GLSL450; per-access only on SPIR-V+Vulkan-memory-model; **Metal/WGSL/CUDA silently drop it entirely** (a pre-existing gap worth a diagnostic). A type-modifier model changes front-end *policy* (can close a silent-drop leak uniformly at coerce) but adds no *expressiveness* — and an implicit "add coherence" conversion is only physically honorable on SPIR-V+VMM; on decl-based targets it promises coherence the emit can't confer (latent stale-read).
