---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787704370615-gydxxz
written_at: 2026-08-26T00:43:20.586Z
---

# globallycoherent on function params rejected in default Slang mode but allowed in -allow-glsl

Triaging #12763: `globallycoherent RWByteAddressBuffer buffer` as a **function parameter** is rejected in default `-lang slang` mode (E31201 "modifier 'globallycoherent' is not allowed here") but is ACCEPTED with `-allow-glsl`.

Root cause — `isModifierAllowedOnDecl` in `source/slang/slang-check-modifier.cpp` (~line 1731-1740). The `GloballyCoherentModifier`/`HLSLVolatileModifier` case has an `if (isGLSLInput) return ... || as<ParamDecl>(decl) || ...;` branch that permits parameters, but the **non-GLSL fall-through `return`** omits `as<ParamDecl>(decl)` entirely — it only allows global VarDecls and struct fields. The sibling GLSL read/write/volatile/restrict arms (just above) allow `ParamDecl` in *both* modes, so this looks like an oversight specific to the coherent/HLSL-volatile arm.

Two cascading lessons for anyone touching memory qualifiers:
1. **The rejection cascades.** When `checkModifier` finds a disallowed modifier it emits E31201 and `return nullptr` — which STRIPS the modifier off the decl. So a `globallycoherent` param loses its qualifier, and the later call-site check `compareMemoryQualifierOfParamToArgument` (`slang-check-expr.cpp:3904-3945`) then sees the argument carrying `kCoherent` but the param carrying nothing → a SECOND error E30048 "argument passed in to parameter has a memory qualifier the parameter type is missing: 'coherent'". Fixing gate #1 makes E30048 disappear; don't try to patch the call-site check.
2. **A second gate hides behind the first.** `slang-check-decl.cpp:13991-14001` rejects memory qualifiers on any parameter whose type is not `ASTNodeType::TextureType` (message "memory qualifier not allowed on a non-image-type parameter"). Today it's masked because gate #1 fires first, but relaxing gate #1 for buffer params exposes gate #2 — RWByteAddressBuffer is not a TextureType. Both must widen together.

Representation note: `coherent`/`globallycoherent` are a single `GloballyCoherentModifier` on the DECL (not the type); `checkModifier` folds them into one `MemoryQualifierSetModifier` bitfield (kCoherent/kReadOnly/kWriteOnly/kVolatile/kRestrict, `slang-ast-modifier.h`). Globals reach emit via a generic `IRMemoryQualifierSetDecoration` (lower-to-ir ~3230, emit-hlsl ~2512), so a param that preserves the modifier can reuse that same path.

Maintainer constraint (csyonghe, CLOSED PR #11460 for #10852): do NOT broaden the `IRAttributedType`-based globallycoherent mechanism as a general design. The decl-modifier→decoration path above is a different mechanism and doesn't collide with that directive — but confirm before widening coherent features.
