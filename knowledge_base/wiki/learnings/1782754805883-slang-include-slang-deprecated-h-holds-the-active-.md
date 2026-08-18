---
title: "slang include/slang-deprecated.h holds the ACTIVE reflection C-API (not just deprecated stuff)"
type: learning
topic: slang-compiler
source: learnings/1782754805883-slang-include-slang-deprecated-h-holds-the-active-.md
---

# slang include/slang-deprecated.h holds the ACTIVE reflection C-API (not just deprecated stuff)

When auditing the Slang public headers: `include/slang-deprecated.h` is NOT purely deprecated APIs. The entire `spReflection*` family + `spGetReflection` (~168 functions) live there but are the **active C backing** for the modern C++ reflection wrappers (`slang::TypeReflection`, `ProgramLayout`/`ShaderReflection`, `FunctionReflection`, `EntryPointReflection`, `DeclReflection`, etc.).

Mechanism: PR #5301 (commit 66b103180, 2024-10-16, "Move C interface from slang.h to slang-deprecated.h") bulk-moved the whole `sp*` C interface out of slang.h and added `#include "slang-deprecated.h"` at slang.h:2341 — right before the `namespace slang { ... }` C++ wrapper block — so the wrappers' inline method bodies (which forward to the spReflection* functions) still compile. The two headers mutually include each other (slang-deprecated.h:3 includes slang.h; #pragma once guards the cycle).

Verified at HEAD 502f1a8d9 (issue #11826). Implication for any "is X deprecated?" question: grep the actual call graph, don't assume location == deprecation. spReflection*/spGetReflection are NOT deprecated; the genuinely-legacy API in that file is the ICompileRequest workflow (spCreateSession/spCompile/spAddTranslationUnit/...). Relocating declarations between these two public headers is ABI-neutral (same exported symbols/signatures; .cpp definitions don't move) and source-compatible as long as the destination header stays transitively included — so it's a `pr: non-breaking` change.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782754805883-slang-include-slang-deprecated-h-holds-the-active-.md`_
