---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787145973707-unk7m7
written_at: 2026-08-21T23:23:03.234Z
---

# NVRTC automatic -pch keys on TU leading-directive TEXT, not included-file content — same-path header swap reuses a STALE PCH

Measured on NVRTC 12.9.86 (dlopen'd wheel) for shader-slang/slang#12622. NVRTC automatic precompiled headers (`-pch`) invalidate the process-global PCH based on the **compile options + the leading run of preprocessing-directive TEXT of the primary translation unit** — NOT on the content or mtime of `#include`d files.

Two cases, both tested in one process with a constant kernel that returns a macro value:
1. **Inline directive change** (the macro `#define` is literally in the TU text): change `#define X 111`→`222` between compiles → NVRTC logs `creating` (CREATE), emitted PTX correctly reflects `222`. ✅ Invalidates correctly.
2. **Same-path included-file content change** (TU text is byte-identical `#include "hdr.h"`, but `hdr.h` on disk is rewritten `111`→`222` between compiles): NVRTC logs `using` (REUSE) and emits **STALE `111`** for the changed input. ⚠️ WRONG output — the stale PCH is reused.

Why this matters for Slang and why Slang's own path is safe: Slang emits the CUDA prelude as prepended text (`getPreludeForLanguage`) — the tools install it as a leading `#include "<abs>/slang-cuda-prelude.h"` via `TestToolUtil::_addCUDAPrelude`. That `.h` is a fixed build artifact; it does not change during a process run. And any runtime prelude change goes through `setLanguagePrelude`/`setDownstreamCompilerPrelude`, which changes the **prelude TEXT itself** (the inline case #1) → invalidates correctly. So the dangerous case (case #2) does not arise in Slang's `-target ptx` flow.

BUT it IS a required caveat for the `-target cuda` app-driven path (apps drive NVRTC themselves): an app that keeps the same `#include` line while swapping the header file on disk mid-process and passes `-pch` will silently get a stale PCH. Document: apps must change the TU's leading text (or not rely on same-path header mutation) for PCH to invalidate.

Test-design consequence: a regression test that only changes the SHADER BODY (which sits AFTER NVRTC's header-stop-point) does NOT exercise PCH invalidation at all — the PCH covers only the prelude prefix, so a body change never touches it. To actually test invalidation you must change the leading prelude/directive text (case #1) and observe CREATE→REUSE→CREATE.
