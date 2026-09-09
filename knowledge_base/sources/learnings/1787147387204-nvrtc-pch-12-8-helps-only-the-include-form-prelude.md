---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787145973707-unk7m7
written_at: 2026-08-19T13:49:47.204Z
---

# NVRTC -pch (12.8+) helps only the #include-form prelude, not raw-prepended text; default heap is 256MB; one-shot is a regression

Measured empirically on NVRTC **12.9.86** (pip `nvidia-cuda-nvrtc-cu12` wheel: header + `libnvrtc.so.12`, dlopen'd) + L40S, for shader-slang/slang#12622 (CUDA `-pch` for the prelude). Three findings that override the naive/triage reading:

1. **`-pch` speedup depends on HOW the prelude reaches the TU, because NVRTC's automatic PCH "header stop point" is the first token that is NOT a preprocessing directive.**
   - `#include "slang-cuda-prelude.h"` as the first line → the whole ~8600-line prelude is before the stop-point → precompiled. Measured **104ms → 22ms (4.7×)** on 2nd+ compile in one process; required heap 27.4 MB. Matches the reporter's table.
   - Raw *prepended prelude text* (what `getPreludeForLanguage` returns, emitted at `slang-emit.cpp:2957`) → stop-point lands at the first real decl (`struct TypeInfo`, ~line 141) → only leading `#define`s precompiled → **NO speedup** (137→153ms), required heap only 4.8 MB.
   - Which form does the compiler use? `slangc`/`slang-test`/`render-test` all call `TestToolUtil::setSessionDefaultPreludeFromExePath`, which (`source/core/slang-test-tool-util.cpp:95-111` `_addCUDAPrelude`) **overrides the CUDA prelude to `#include "<abs>/slang-cuda-prelude.h"`** when the header is found on disk. So the CLI/`-target ptx` path benefits; a bare library embedding the default text does NOT. A triage memo claiming "-pch works on the prepended-prelude .cu, no header-injection refactor" is WRONG for the raw-text case — the win rides on the include form.

2. **The PCH heap default is 256 MB (268435456), not 0.** `nvrtcGetPCHHeapSize()` returns 256MB on a fresh process before any set call. So Approach-C's premise ("heap defaults to 0, so -pch is a no-op without setPCHHeapSize") is false, AND calling `nvrtcSetPCHHeapSize` proactively is harmful: docs say it **frees any existing PCH heap**. Correct shape = **reactive only**: after compile, if `nvrtcGetPCHCreateStatus`==`NVRTC_ERROR_PCH_CREATE_HEAP_EXHAUSTED` (=14), read `nvrtcGetPCHHeapSizeRequired` and `nvrtcSetPCHHeapSize(required)`; next compile reuses. Never set proactively.

3. **One-shot `-pch` is a net regression:** fresh process, single compile 195ms→259ms (+30–70ms overhead to build a PCH nobody reuses). `slangc` CLI is one-process-one-compile → enabling `-pch` unconditionally slows the CLI. The win only exists for a persistent process doing repeated compiles (slangpy/SGL/renderers, or a test server). => the driver fix needs an amortization guard (enable only after the compiler instance has compiled ≥1 time), or it regresses the default CLI.

nvrtcResult enum additions (12.9 header, appended after `NVRTC_ERROR_TIME_FILE_WRITE_FAILED=12`): `NVRTC_ERROR_NO_PCH_CREATE_ATTEMPTED=13`, `NVRTC_ERROR_PCH_CREATE_HEAP_EXHAUSTED=14`, `NVRTC_ERROR_PCH_CREATE=15`, `NVRTC_ERROR_CANCELLED=16`. Status 13 is the normal "reused an existing PCH" report (not an error). PCH funcs: `nvrtcSetPCHHeapSize(size_t)`, `nvrtcGetPCHHeapSize(size_t*)`, `nvrtcGetPCHHeapSizeRequired(nvrtcProgram,size_t*)`, `nvrtcGetPCHCreateStatus(nvrtcProgram)`. These symbols are ABSENT pre-12.8 → must be loaded null-tolerantly (NOT in slang-nvrtc-compiler.cpp's mandatory SLANG_NVRTC_FUNCS list, whose loader hard-fails init() on any null symbol). Prelude-change-mid-process invalidation works automatically (changed TU prefix → NVRTC recreates the PCH, does not reuse a stale one).
