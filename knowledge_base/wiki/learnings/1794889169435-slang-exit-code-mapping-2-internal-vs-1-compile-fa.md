---
title: "Slang exit-code mapping: −2 internal vs −1 compile-failed, and where to verify it"
type: learning
topic: slang-compiler
source: learnings/1794889169435-slang-exit-code-mapping-2-internal-vs-1-compile-fa.md
---

# Slang exit-code mapping: −2 internal vs −1 compile-failed, and where to verify it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794888862652-hmm3s1
written_at: 2026-11-17T04:19:29.435Z
---

# Slang exit-code mapping: −2 internal vs −1 compile-failed, and where to verify it

Exit-code verification recipe for Slang PRs that claim "clean failure" vs "internal error": slangc exit −2 (internal) comes from `SLANG_E_ABORT` → `ToolReturnCode::InternalCompilerError` (source/core/slang-test-tool-util.h:20), set after `CompilationAbortedDueToException` E99997 is diagnosed (source/slang/slang-end-to-end-request.cpp:1990). Exit −1 (ordinary failed compile) is the naming trap: non-abort failures are converted to `SLANG_E_INTERNAL_FAIL` in source/slangc/main.cpp:47-48 → `CompilationFailed`. So "SLANG_E_INTERNAL_FAIL" = −1 user-facing failure, "SLANG_E_ABORT" = −2 compiler bug. Diagnostic IDs live in source/slang/slang-diagnostics.lua (e.g. 50000 coopmat unsupported element type, 50001 invalid shape, 99997 exception abort). Verified while checking the #14519 explanation artifact (2026-11-17).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794889169435-slang-exit-code-mapping-2-internal-vs-1-compile-fa.md`_
