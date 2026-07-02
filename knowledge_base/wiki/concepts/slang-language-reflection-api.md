---
title: "Slang Reflection API"
type: concept
group: slang-language-core
tags: [reflection, reflection-json, type-layout, binding, program-layout, slang-deprecated-h]
source_count: 8
---

# Slang Reflection API

Slang exposes a C reflection API (`spReflection*`) and C++ wrappers (`TypeReflection`, `ProgramLayout`, `DeclReflection`, etc.) for querying layout, bindings, and type structure of compiled shaders. Several non-obvious pointer-identity and serialization constraints apply.

## TypeReflection Pointer Identity

`slang::TypeReflection*` is an internal `Type*` pointer deduplicated only within a single `ASTBuilder`. A module's `getModuleReflection()` decl tree and the linked program's `getLayout()->findTypeByName()` can be backed by different `ASTBuilder` instances (linking and generic specialization build fresh nodes), so the same logical type may have different pointers. Do not compare `TypeReflection*` across these two sources — key on `getFullName()` instead ([Slang reflection: TypeReflection* pointer identity is not safe across ProgramLayout vs module reflection](wiki/learnings/1780993688372-slang-reflection-typereflection-pointer-identity-i.md)).

## Reflection-JSON CLI and Crash on Failed Compile

`slangc -reflection-json <path>` (NOT `-emit-reflection-json`) emits a JSON layout. The programmatic API is `spReflection_ToJson(SlangReflection*, SlangCompileRequest*, ISlangBlob**)` ([Serializing Slang reflection: use -reflection-json or reflect from a loaded module](wiki/learnings/1782323528074-serializing-slang-reflection-use-reflection-json-o.md)).

`slangc -reflection-json` crashes (SIGSEGV, exit 139) on any failed compile when `-target` is also present because the emission block runs without checking the compile result, then dereferences a null `m_specializedGlobalAndEntryPointsComponentType`. The crash manifests on every error class and every target — dropping `-target` is the only graceful path (produces E52009). This is not a regression; the path was introduced in 2025-07-24 and never had a compile-result gate ([Localizing slangc -reflection-json crash on failed compile (#11683) + REFLECTION test directive gotcha](wiki/learnings/1782146682704-localizing-slangc-reflection-json-crash-on-failed-.md), [slang 11683 reflection-json crash is broad scope and NOT a regression](wiki/learnings/1782203064448-slang-11683-reflection-json-crash-is-broad-scope-a.md)).

Test-directive note: `//TEST:REFLECTION:` in test files drives the `slang-reflection-test` tool, NOT the `slangc -reflection-json` CLI path. A regression test for a `-reflection-json` bug must use a `SIMPLE`/`DIAGNOSTIC_TEST:SIMPLE` directive invoking slangc directly ([Localizing slangc -reflection-json crash on failed compile (#11683) + REFLECTION test directive gotcha](wiki/learnings/1782146682704-localizing-slangc-reflection-json-crash-on-failed-.md)).

## Import vs Include: Missing link() Call

A global resource with `[[vk::binding(n,set)]]` reflects and emits correctly via `#include` but returns nothing via `import` when the host calls `getLayout()`/`getEntryPointCode()` directly on a composite without calling `IComponentType::link()` first. Imported module globals are recorded as *requirements*, not the importing module's own params; `fillRequirements` (which folds requirement modules into the layout) runs only from `ComponentType::link()`. `slangc` always links before reflecting, which is why the bug does not reproduce via the CLI ([import-vs-include reflection/binding loss = missing IComponentType::link()](wiki/learnings/1782215579233-import-vs-include-reflection-binding-loss-missing-.md)).

## Serializing and Caching Reflection

Reflection objects are live pointers into session memory and cannot be serialized directly. Two supported strategies: (1) JSON reflection via `-reflection-json` parsed into custom POD structs; (2) serialize the compiled module and reflect from it at runtime via a live Slang session ([Serializing Slang reflection: use -reflection-json or reflect from a loaded module](wiki/learnings/1782323528074-serializing-slang-reflection-use-reflection-json-o.md)).

## Per-Target Layout Verification

Emitted shader stride and reflection-reported stride can disagree. For `RWStructuredBuffer<T, ScalarDataLayout>`, SPIR-V emitted `ArrayStride 24` while reflection-json reported stride 32 (reflection computes layout via the AST layer which ignores the per-buffer marker). Always measure both `spirv-asm OpDecorate ArrayStride` and `-reflection-json` field offsets separately ([Verifying Slang per-target buffer layout: measure emitted AND reflection separately; use a pinned worktree + full build](wiki/learnings/1782325331597-verifying-slang-per-target-buffer-layout-measure-e.md)).

The peer session concurrent-reset trap: a shared checkout can be reset by concurrent sessions mid-task; use `git worktree add` to isolate a fixed-commit verification ([Verifying Slang per-target buffer layout: measure emitted AND reflection separately; use a pinned worktree + full build](wiki/learnings/1782325331597-verifying-slang-per-target-buffer-layout-measure-e.md)).

## findFieldIndexByName: Qualified Lookup and Duplicate Globals

`spReflectionTypeLayout_findFieldIndexByName` returns the first matching field and stops — a second same-named global from a different module is unreachable by name alone. However, its `matchName` comparator already supports qualified lookup (`Module.var` or `Module::var`) by matching the last segment against the var name and walking `getParentDecl` for qualifiers — so qualified lookup may already resolve the specific module's global. Both duplicates are always reachable by index via `getFieldCount`/`getFieldByIndex` ([Slang reflection findFieldIndexByName already supports qualified module.var lookup](wiki/learnings/1782456046812-slang-reflection-findfieldindexbyname-already-supp.md)).

## slang-deprecated.h Holds the Active C Reflection API

`include/slang-deprecated.h` is NOT purely deprecated. The entire `spReflection*` family (~168 functions) and `spGetReflection` live there as the **active C backing** for the modern C++ reflection wrappers. PR #5301 (2024-10-16) moved the whole `sp*` C interface out of `slang.h` and added `#include "slang-deprecated.h"` immediately before the `namespace slang` C++ wrapper block, so the wrapper inline methods still compile. The genuinely-legacy API in that file is the `ICompileRequest` workflow (spCreateSession, spCompile, etc.) ([slang include/slang-deprecated.h holds the ACTIVE reflection C-API (not just deprecated stuff)](wiki/learnings/1782754805883-slang-include-slang-deprecated-h-holds-the-active-.md)).

---
**Source learnings (8):**
- [Slang reflection: TypeReflection* pointer identity is not safe across ProgramLayout vs module reflection](wiki/learnings/1780993688372-slang-reflection-typereflection-pointer-identity-i.md)
- [Localizing slangc -reflection-json crash on failed compile (#11683) + REFLECTION test directive gotcha](wiki/learnings/1782146682704-localizing-slangc-reflection-json-crash-on-failed-.md)
- [slang 11683 reflection-json crash is broad scope and NOT a regression](wiki/learnings/1782203064448-slang-11683-reflection-json-crash-is-broad-scope-a.md)
- [import-vs-include reflection/binding loss = missing IComponentType::link()](wiki/learnings/1782215579233-import-vs-include-reflection-binding-loss-missing-.md)
- [Serializing Slang reflection: use -reflection-json or reflect from a loaded module](wiki/learnings/1782323528074-serializing-slang-reflection-use-reflection-json-o.md)
- [Verifying Slang per-target buffer layout: measure emitted AND reflection separately](wiki/learnings/1782325331597-verifying-slang-per-target-buffer-layout-measure-e.md)
- [Slang reflection findFieldIndexByName already supports qualified module.var lookup](wiki/learnings/1782456046812-slang-reflection-findfieldindexbyname-already-supp.md)
- [slang include/slang-deprecated.h holds the ACTIVE reflection C-API (not just deprecated stuff)](wiki/learnings/1782754805883-slang-include-slang-deprecated-h-holds-the-active-.md)
_Catalog: [[wiki/index.md]]_
