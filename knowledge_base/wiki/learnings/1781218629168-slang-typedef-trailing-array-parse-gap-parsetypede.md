---
title: "Slang typedef trailing-array parse gap (parseTypeDef vs declarator machinery)"
type: learning
topic: slang-compiler
source: learnings/1781218629168-slang-typedef-trailing-array-parse-gap-parsetypede.md
---

# Slang typedef trailing-array parse gap (parseTypeDef vs declarator machinery)

**Issue:** shader-slang/slang#11567 — `typedef int arr[2];` (C/HLSL trailing-array declarator) fails with `E20001: unexpected integer literal, expected identifier`, while `typedef int[2] arr;` and `typealias` work. Predecessor #1280 (2023) was the SAME request, closed NOT_PLANNED ("bug bankruptcy"). Re-raised 2026-06-11.

**Root cause (source/slang/slang-parser.cpp, HEAD 45c04170f):** `parseTypeDef` (:4852-4868) parses `<type-expr> <Identifier> ;` only — `ParseTypeExpAllowDecl()` (:4857) consumes just `int`, `ReadToken(Identifier)` (:4859) reads the name, `AdvanceIf(Semicolon)` (:4865) no-ops on the `[`, leaving `[2];` dangling → top-level loop misreads `[` as an attribute start, hence the integer-literal error. There's a standing `// TODO(tfoley): parse an actual declarator` at :4856 flagging exactly this.

**Why the fix is parser-only (no cascade):** the leading-array form `typedef int[2] arr;` already round-trips through check/lower/emit, so the array-typed-alias AST is fully supported downstream. The fix just needs `parseTypeDef` to produce that same AST for the trailing-array form.

**Reusable machinery typedef bypasses:** ordinary var/field decls (`int arr[2];` works) go through `ParseDeclaratorDecl` (:3304) → `_parseTypeSpec` (:3311) → leading-array via `parseBracketTypeSuffix` (:3333) → `parseInitDeclarator` (:3397) → `UnwrapDeclarator` (:3415/:3436/:3458). The trailing `[` postfix loop lives in `parseDirectAbstractDeclarator` (:2350-2371 → ArrayDeclarator :2357), and `UnwrapDeclarator`'s array case (:2509-2522) folds each ArrayDeclarator into an ArrayTypeExpr.

**Principled fix:** route `parseTypeDef` through the shared declarator path — base type spec, then `parseDeclarator` (NOT `parseInitDeclarator`; typedefs take no initializer/semantics), then `UnwrapDeclarator` for name + trailing suffixes. Preserve existing leading-array/pointer forms; verify against the typedef test corpus.

**Triage note:** native GitHub Issue Type was pre-set to "Language Maturity" (a custom shader-slang type beyond Bug/Feature) → leave untouched per human-triage-authoritative rule. Worth knowing this repo uses custom Issue Types, so a "blank → set Bug/Feature" decision must first GraphQL-query the current type.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781218629168-slang-typedef-trailing-array-parse-gap-parsetypede.md`_
