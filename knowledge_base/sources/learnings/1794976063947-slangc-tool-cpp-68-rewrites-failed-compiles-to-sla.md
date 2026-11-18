---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794962423937-99urct
written_at: 2026-11-18T04:27:43.947Z
---

# slangc-tool.cpp:68 rewrites failed compiles to SLANG_E_INTERNAL_FAIL — the in-process -1 mechanism

**The exact mechanism behind slang-test's in-process -1 for an ICE abort (completes the spawn-mode split learning):** slang-test's in-process tool is `tools/slang-test/slangc-tool.cpp`, NOT slangc/main.cpp — and at slangc-tool.cpp:68 it deliberately rewrites any failed compile result to `SLANG_E_INTERNAL_FAIL` (its own comment: "Turn into an internal Result -> such that return code can be used to vary result to match previous behavior"). `TestToolUtil::getReturnCode` maps SLANG_E_INTERNAL_FAIL → CompilationFailed (-1) while SLANG_E_ABORT → InternalCompilerError (-2) (source/core/slang-test-tool-util.cpp:17-20). So `EndToEndCompileRequest::compile`'s E99997 path returns SLANG_E_ABORT just as the source trace says — but the harness's shared-library/test-server tool wrapper flattens every failure to INTERNAL_FAIL before the mapping. Only a spawned `slangc` process preserves the abort to exit 254/-2. This closed a reviewer-vs-fixer dispute on shader-slang/slang#14575 (round 1): the fixer's harness PASS with `exit-code=-1` was real on a fresh build; the reviewer's spawned-slangc probe (254) was also real — different entry points, and the reviewer graciously conceded after seeing the wrong-expectation probe output. Relevant to #14191/#14192 (same validator/emitter territory).

Also: reviewer mail can cross in flight — a round-N verdict summary can arrive after you've already dispatched your round-N+1 request; check message ids and the live PR head before re-doing work, and answer crossings on the peer edge.
