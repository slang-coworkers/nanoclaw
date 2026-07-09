---
title: "slang #11984: -g2 DebugSource for #line files bypasses canonical BOM strip (fresh-read fallback)"
type: learning
topic: slang-compiler
source: learnings/1783468265984-slang-11984-g2-debugsource-for-line-files-bypasses.md
---

# slang #11984: -g2 DebugSource for #line files bypasses canonical BOM strip (fresh-read fallback)

shader-slang/slang#11984 (triaged @ HEAD 33f9ed0ce, bug/low/P3, reproduced).

**Symptom:** `slangc -target spirv -g2` embeds a UTF-8 BOM (`EF BB BF` / U+FEFF) into a `DebugSource`/`OpString` record when the embedded file is referenced only by a `#line` directive, while source line/column data stays BOM-free → 1-code-point misalignment between the embedded text and the location info that indexes into it.

**Root cause (non-obvious):** Slang has TWO DebugSource producers in `slang-lower-to-ir.cpp`:
- **Bulk path** (~L15302-15310): iterates `translationUnit->getSourceFiles()`, uses `source->getContent()` — which is the DECODED, BOM-stripped `m_content`. Correct.
- **Fresh-read fallback** `getOrEmitDebugSource` (~L9564-9583): when a path has no loaded `SourceFile` in the source manager (exactly the `#line`-named-path case — the physically-lexed file has a different path, so `findSourceFileByPathRecursively`/`findSourceFile` return null), it calls `getLinkage()->getFileSystemExt()->loadFile(pathInfo.foundPath, outBlob)` and wraps the RAW blob bytes as `UnownedStringSlice` content, then `emitDebugSource(...)`. This branch NEVER routes through `SourceFile::setContents`, so the canonical BOM strip is skipped.

**Where the BOM is normally stripped (the source of truth):** `SourceFile::setContents(ISlangBlob*)` in `source/compiler-core/slang-source-loc.cpp:619-663` — calls `CharEncoding::determineEncoding(bytes,size,offset)` (`source/core/slang-char-encode.cpp:118`), which returns UTF-8 + `offset=3` for a BOM file; decodes from `rawBegin+offset`, so `getContent()` is ALWAYS BOM-free. All normal source loads (`createSourceFileWithBlob`/`createSourceFileWithString`) go through this.

**Consumer is innocent:** `slang-emit-spirv.cpp:2136-2173` emits the operand-1 IRStringLit verbatim — fix the PRODUCER, not the emitter. Corroboration it's a real defect: `DebugSourceLineColumnCache` uses `UTF8Util::calcCodePointCount`, so embedded text is *expected* BOM-free UTF-8.

**Fix direction:** in the fresh-read fallback, decode/BOM-strip `outBlob` (reuse `CharEncoding::determineEncoding`+`getEncoding(type)->decode`) before wrapping as content — mind that `UnownedStringSlice` is non-owning, so the decoded buffer must outlive `emitDebugSource`. More principled alt: route the fresh-read file through `createSourceFileWithBlob`→`getContent()` (single source of truth) but that mutates source-manager state mid-emit (risk).

**Repro trick (GPU-free, disassembler-free):** the `spirv-asm` path needs glslang/spirv-dis (often unavailable in agent env). Use `-target spirv -g2 -O0 -emit-spirv-directly -o out.spv` (binary, no downstream compiler) and grep the raw bytes: the BOM `EF BB BF` appears immediately before the `#line`-referenced file's source-text embed and nowhere else. Buggy block last touched by PR #9945 (2026-02-12), byte-identical across recent SHAs → any recent prebuilt is HEAD-representative for this bug.

Sibling issues #11982 (dup DebugSource from divergent path spelling) / #11983 (DebugFunction scope) — same reporter (pdeayton-nv), same `-g2`+`#line`/`import` SPIR-V debug-info subsystem, but three DISTINCT root causes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783468265984-slang-11984-g2-debugsource-for-line-files-bypasses.md`_
