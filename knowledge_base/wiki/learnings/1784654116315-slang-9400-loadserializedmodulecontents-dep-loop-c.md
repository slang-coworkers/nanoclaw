---
title: "slang#9400: loadSerializedModuleContents dep-loop content is dead weight; up-to-date check is independent"
type: learning
topic: slang-compiler
source: learnings/1784654116315-slang-9400-loadserializedmodulecontents-dep-loop-c.md
---

# slang#9400: loadSerializedModuleContents dep-loop content is dead weight; up-to-date check is independent

**shader-slang/slang#9400** (module serialization / linkage / file-dependency tracking). Verified @HEAD 6a244fee2.

**Finding:** The dependency-loading loop in `Linkage::loadSerializedModuleContents` (`slang-session.cpp:2248-2275`) eagerly `loadSourceFile(...)`s (materializes full text) every dep of a loaded `.slang-module`, but on the load path that **content is dead weight**. Verified empirically: a module compiles to GLSL fine with the original `.slang` source deleted (`slangc -r x.slang-module -target glsl ...` → exit 0). Only dependency **PATHS** feed real consumers.

**Who consumes what (source-verified):**
- Load-path digest is **chunk-copied not recomputed**: `module->setDigest(moduleChunk->getDigest())` (`slang-session.cpp:2277`).
- `UseUpToDateBinaryModule` staleness check `isBinaryModuleUpToDate` (`slang-session.cpp:1825-1892`, called at 1282-1288 BEFORE loadSerializedModule) reads the **serialized RIFF chunk** `moduleChunk->getFileDependencies()` and does its OWN loadSourceFile+digest loop — it does NOT read the in-memory `module->m_fileDependencyList` the loop populates. So removing/deferring the loop would NOT break up-to-date checking.
- Reflection `Module::getDependencyFileCount/Path` (`slang-module.cpp:312-323`) and module-from-module re-serialization (`slang-serialize-container.cpp:310-347`) use dep **PATHS only**.

**CRITICAL DISTINCTION (a code-reader subagent got this wrong):** `moduleChunk->getFileDependencies()` (serialized RIFF chunk, always present) is NOT the same as `module->getFileDependencies()` (in-memory list, populated by the loop). A subagent claimed removing the loop breaks the up-to-date check by conflating the two. Always disambiguate `moduleChunk->` vs `module->` when reasoning about slang module deps. Verify load-bearing subagent claims by reading the two call sites yourself.

**Missing-snippet from precompiled modules (`error 36107` prints `(0)`) is a SEPARATE mechanism**, not the loaded source: deserialized SourceViews are built from empty-content SourceFiles — `createSourceFileWithSize(pathInfo, size)` (size only, no text) at `slang-serialize-source-loc.cpp:270-277` — and the diagnostic renderer bails at `if (!sourceFile->hasContent()) return;` (`slang-diagnostic-sink.cpp:290-293`). The content the loop loads lives in different SourceFile objects than the renderer consults, so it never reaches diagnostics.

**Maintainer steer:** core maintainer tangent-vector (Tim Foley) called this whole path/dependency/source-loc subsystem "rotten to its core" and wants a first-principles redesign after a design session, NOT a band-aid. Issue assigned to jkwak-work. Triaged→parked for maintainer, no auto-fixer. Fix candidate (if taken): register dep PATHS without materializing content + add the missing regression test (getDependencyFilePath on a loaded module — zero coverage today, which is why "comment it out, tests still pass").

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784654116315-slang-9400-loadserializedmodulecontents-dep-loop-c.md`_
