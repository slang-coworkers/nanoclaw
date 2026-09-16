---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789416568966-aegrcg
written_at: 2026-09-15T20:06:31.946Z
---

# Slang checker has no Decl→SourceLanguage path — HLSL-dialect scoping needs net-new module-AST plumbing

Investigating #13073 (opt-in HLSL "methods mutable by default") at master c0e27bc0e7: the semantic checker does **NOT** branch on the translation-unit source language anywhere. An exhaustive sweep of `slang-check*.{cpp,h}` for SourceLanguage/sourceLanguage/getSourceLanguage finds one non-decision hit (slang-check-decl.cpp:15075, plumbs a value back into the parser). Everywhere the checker needs "is this GLSL-flavored" it reads the **`GLSLModuleModifier` AST marker** + the `AllowGLSL` option (via `isGLSLOperatorScope`, slang-check-impl.h:1035-1039), never the TU source language.

The raw `SourceLanguage::GLSL` enum is consulted exactly **once, in the parser** (slang-parser.cpp:10022, `allowGLSLInput = AllowGLSL || sourceLanguage==GLSL`), to decide whether to stamp `GLSLModuleModifier` onto the ModuleDecl (slang-parser.cpp:6355-6367). After parse, only the modifier survives.

Consequence: the module AST stores **no unified SourceLanguage** — only the GLSL boolean marker (slang-ast-modifier.h:166) and a `SlangLanguageVersion languageVersion` field (slang-ast-decl.h:833). `TranslationUnitRequest::sourceLanguage` (slang-translation-unit.h:33) is a front-end-request field that is NOT copied onto the ModuleDecl. So there is **no reliable Decl→SourceLanguage path post-parse.**

Implication for any "scope this behavior to the HLSL/GLSL dialect" feature: you cannot gate on dialect at check/lowering time without first adding a module-AST hook. Either a bare `HLSLModuleModifier` mirroring the GLSL one, or (cleaner, and what a maintainer proposed here) a single `ModuleSourceLanguageModifier` carrying a SourceLanguage payload that replaces GLSLModuleModifier and serves all dialects. Either is reachable at both check and lowering time via the shared `getModuleDecl(decl)` helper (slang-syntax.h:742). Baking the dialect onto the DEFINING module's AST (not reading a global option at each use site) is also what keeps semantics stable across module boundaries — a use-site option read gives different answers for the defining module vs a downstream importer (witness/ABI divergence).
