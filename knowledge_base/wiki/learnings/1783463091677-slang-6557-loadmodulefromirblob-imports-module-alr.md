---
title: "slang#6557 loadModuleFromIRBlob-imports-module already fixed by RIFF rewrite (#7041)"
type: learning
topic: slang-compiler
source: learnings/1783463091677-slang-6557-loadmodulefromirblob-imports-module-alr.md
---

# slang#6557 loadModuleFromIRBlob-imports-module already fixed by RIFF rewrite (#7041)

Triaging shader-slang/slang#6557 (2025-03-10): reporter said `loadModuleFromIRBlob("A.slang-module")` returns nullptr when module A `import`s module `common`, blaming a `containerData.modules.getCount() != 1` gate in slang.cpp (~L4092/L4436 @ commit 5673edfe) — the serialized container held 2 modules so the "exactly one" check failed.

**Verdict: already fixed on top-of-tree (HEAD 33f9ed0ce).** That gate NO LONGER EXISTS. The serialized-module load path was rewritten from `SerialContainerData`/`SerialContainerUtil::read` to RIFF chunks by PR #7041 "Cleanups related to RIFF support" (commit 4c76b2759, merged 2025-05-12 — AFTER the issue was filed). Now:
- Write: `ModuleEncodingContext::encode(Module*)` (slang-serialize-container.cpp:184) writes ONLY the module's own IR/AST; imported deps are stored as file-dependency PATH references via `encodeModuleDependencyPaths` (:234), not as embedded module chunks. So `A.slang-module` has ONE `smod` chunk, not two.
- Load: `Linkage::loadBinaryModuleImpl` (slang-session.cpp:1250) → `ModuleChunk::find` (slang-serialize-container.cpp:429) = `findListChunkRec(kModuleFourCC)` returns the FIRST module chunk and never fails on count>1; `loadSerializedModuleContents` (~:2251) resolves the recorded dep paths dynamically.

**Empirical repro on ToT is the deciding evidence** (don't trust old cited line numbers — the file moved from slang.cpp to slang-session.cpp): `slangc -dump-module A.slang-module` is exactly the reporter's API path (slang-options.cpp:3893, DumpModule case first tries loadModuleFromSourceString then falls back to loadModuleFromIRBlob). On ToT it exits 0 and prints A's IR with the `import(...)` intact — no nullptr. Works even with source files removed (forces the IR-blob fallback).

**Coverage gap = the actionable deliverable when a requester asks for a PR on an already-fixed bug:** `tools/slang-unit-test/unit-test-ir-blob.cpp` has 8 subtests but every module is self-contained — the exact issue scenario (importing module via loadModuleFromIRBlob) is unguarded. `unit-test-multi-file-module-cache.cpp` loads an importing precompiled module but via file-based `loadModule()`, not the explicit blob API. So: don't just close as fixed — hand the fixer a regression test that registers `common`'s blob then loads A's blob in a fresh session, asserting both != nullptr. That satisfies "implement a PR" and pins the fix.

General lesson: for an old module/serialization bug with a precise line pointer, always check whether an intervening rewrite (grep the cited symbol; `git log -S`) removed the code before investigating the cited layer — and prove disposition with an on-ToT repro, not by reading the (possibly-vanished) code.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783463091677-slang-6557-loadmodulefromirblob-imports-module-alr.md`_
