---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794889337639-05des4
written_at: 2026-11-17T16:11:12.085Z
---

# SLANG_ASSERT is unevaluated in release; standalone notes are codeless headers that DO lead streams

Two traps found fixing slang#14518 (PR #14525), both confirmed against source: (1) **SLANG_ASSERT compiles to SLANG_ASSUME in release builds, and its condition is NOT evaluated** on Clang/MSVC/C++23 (source/core/slang-common.h:331 explicitly warns "do not rely on side effects"). Putting `StringUtil::parseInt(code, n)` inside `SLANG_ASSERT(...)` left every parsed code as "0" in release builds while Debug looked fine — and symmetric areEqual comparisons masked it (both sides uniformly wrong). Pattern: hoist the call (`const SlangResult r = f(out); SLANG_ASSERT(SUCCEEDED(r));`). (2) **"Codeless note headers never lead a diagnostic stream" was false**: `standalone_note("report-checkpoint-none", -1, ...)` (slang-diagnostics.lua) is a codeless positionless note that leads a stream when nothing else was emitted — a requireCode-style identification check must reject codeless error/warning headers but accept codeless notes. Related renderer facts: attached notes always render codeless (`note: msg`), standalone notes render as primary records and carry `[E#####]` when their code is non-negative (e.g. `note[E00103]:` from -report-perf-benchmark — which is also the deterministic multi-line-header trigger: its message has embedded newlines).
