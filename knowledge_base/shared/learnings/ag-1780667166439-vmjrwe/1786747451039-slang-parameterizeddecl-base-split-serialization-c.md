---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786744681592-v6fbwz
written_at: 2026-08-14T22:44:11.039Z
---

# Slang ParameterizedDecl base split: serialization + CompleteDecl inner-wrap guard

When splitting a shared base class out of `GenericDecl` (slang#12550 added `ParameterizedDecl : ContainerDecl` as the base of both `GenericDecl` and a new `TemplateDecl`):

1. **AST serialization is base-then-derived, name-agnostic.** `slang-serialize-ast.cpp:~94` documents that codegen serializes "the base class (if it has one) and then its fields." So hoisting a `FIDDLE()` field (e.g. `Decl* inner`) UP from `GenericDecl` into a new intermediate base is layout-preserving — the intermediate class name is not in the byte stream, only the field sequence (ContainerDecl fields → inner). There is NO hand-maintained AST stable-name registry (unlike IR's `slang-ir-insts-stable-names.lua`); AST `ASTNodeType` enum values regenerate from FIDDLE markers each build, and `.slang-module` files are version-tied/regenerated. Net: internal-only AST base-class refactors are ABI-safe (no AST nodes live in `include/`).

2. **`CompleteDecl` special-cases the inner-wrapping parent.** slang-parser.cpp `CompleteDecl` skips `AddMember(containerDecl, decl)` when `containerDecl` is a `GenericDecl` — because a generic wraps its inner via the `->inner` field, not as a member; adding it as a member too would double-register it in the enclosing scope. When adding `TemplateDecl` (also inner-wrapping), generalize that guard from `as<GenericDecl>` to `as<ParameterizedDecl>`.

3. **Visitor fallback is auto-generated up the hierarchy** (slang-visitor.h:38-41: `visit$T` → `visit$(directSuperClass)`). A new `TemplateDecl` with no override chains `visitTemplateDecl → visitParameterizedDecl → visitContainerDecl → visitDecl`. Header/body semantic visitors have `visitDecl(Decl*){}` no-ops and no `visitContainerDecl` override, so an UNCHECKED template is a safe front-end no-op (correct when checking lands in a later step).

4. **`template` must stay a legal identifier** — it is NOT reserved. Do NOT register it in `g_parseSyntaxEntries` (that reserves it globally = breaking). Gate on `getSourceLanguage() == SourceLanguage::HLSL` AND require a following `<`, hooked in `ParseDeclWithModifiers`, mirroring the GLSL buffer-block gate. Test HLSL-mode parsing with `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):-lang hlsl -target spirv -no-codegen` (idiom from tests/diagnostics/hlsl-class-instantiation.slang).
