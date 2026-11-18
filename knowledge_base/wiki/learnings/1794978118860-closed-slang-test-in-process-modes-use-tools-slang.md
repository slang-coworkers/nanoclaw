---
title: "Closed: slang-test in-process modes use tools/slang-test/slangc-tool.cpp which flattens all failures to -1 — round-1 CI-failure prediction was wrong, fixer's PASS was real"
type: learning
topic: slang-compiler
source: learnings/1794978118860-closed-slang-test-in-process-modes-use-tools-slang.md
---

# Closed: slang-test in-process modes use tools/slang-test/slangc-tool.cpp which flattens all failures to -1 — round-1 CI-failure prediction was wrong, fixer's PASS was real

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794968381511-gmcpho
written_at: 2026-11-18T05:01:58.860Z
---

# Closed: slang-test in-process modes use tools/slang-test/slangc-tool.cpp which flattens all failures to -1 — round-1 CI-failure prediction was wrong, fixer's PASS was real

Final close of the #14575 exit-code thread (2026-11-18, verified in-tree): the in-process tool that slang-test loads for slangc is `tools/slang-test/slangc-tool.cpp`, NOT `source/slangc/main.cpp`. At slangc-tool.cpp:67-68 it deliberately flattens every failed compile result — `SLANG_FAILED(compileRes) ? SLANG_E_INTERNAL_FAIL : compileRes`, so `SLANG_E_ABORT` included — and `TestToolUtil::getReturnCode(SLANG_E_INTERNAL_FAIL)` = CompilationFailed (-1). Hence: spawned `slangc` ICE-abort exits 254/-2 (source/slangc/main.cpp preserves SLANG_E_ABORT per #14303), but shared-library and test-server harness modes report -1 for the same compile. My round-1 "this test will fail in CI" prediction (and Reviewer A's round-1 bug as stated) was therefore wrong for the in-process modes CI uses; the fixer's fresh-harness "2/2 PASS" was real; my "stale libslangc-tool.so" suspicion is retracted. Durable traps: (1) when tracing slang-test result codes, grep `tools/slang-test/*-tool.cpp` — the harness's inner mains live there, not in `source/`; (2) my own container's slang-test (2026-09-15) additionally predates the #14422 exit-code check entirely, so BOTH facts were needed to explain the observations; (3) never predict CI outcomes from a spawned CLI's `echo $?`. The round-1 fix direction (never enshrine an ICE; don't let tests depend on abort mapping) was still correct on design grounds and shipped as E55219.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794978118860-closed-slang-test-in-process-modes-use-tools-slang.md`_
