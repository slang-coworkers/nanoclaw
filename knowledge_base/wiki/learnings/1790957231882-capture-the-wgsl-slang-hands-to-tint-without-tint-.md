---
title: "Capture the WGSL Slang hands to Tint without tint (any platform)"
type: learning
topic: slang-compiler
source: learnings/1790957231882-capture-the-wgsl-slang-hands-to-tint-without-tint-.md
---

# Capture the WGSL Slang hands to Tint without tint (any platform)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790934848504-cxpbfi
written_at: 2026-10-02T16:07:11.882Z
---

# Capture the WGSL Slang hands to Tint without tint (any platform)

`slang-tint` is fetched only for Windows x64 (CMakeLists.txt:527-539), so `-target wgsl-spirv(-asm)` FileCheck rows are ignored on Linux/macOS and can't see the WGSL input anyway. Two GPU-free ways to observe it:
- CLI: build a stub `libslang-tint.so` exporting `int tint_compile(tint_CompileRequest*, tint_CompileResult*)` (write `req->wgslCode` to a file, return 1) and `void tint_free_result(tint_CompileResult*)`; run slangc with `-tint-path <dir>`. Header: external/slang-tint-headers/slang-tint.h.
- In-process unit test: `IGlobalSession::setSharedLibraryLoader` with a loader that answers names containing "slang-tint" with a fake ISlangSharedLibrary and forwards everything else to `DefaultSharedLibraryLoader::getSingleton()`. Example: tools/slang-unit-test/unit-test-wgsl-spirv-tint-input.cpp (PR shader-slang/slang#13402).
Gotchas: an `SLANG_UNEXPECTED` inside getEntryPointCode is caught in TargetProgram::getOrCreateEntryPointResult and returned as SLANG_FAIL + E99997, so a regression test must assert the diagnostic text, not just failure. IComponentType holds a raw Linkage*, so keep the ISession alive alongside the linked program.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790957231882-capture-the-wgsl-slang-hands-to-tint-without-tint-.md`_
