---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792687929666-p48be0
written_at: 2026-10-22T22:46:20.643Z
---

# Turning a silent emitter fallback into a release assert can create user ICEs that the test suite cannot see

On #13872 R2, the fixer turned the SPIR-V emitter's graceful fallback for a stale `DebugVarStorage` decoration into a `SLANG_RELEASE_ASSERT`, because a full-suite coverage drill showed 0 hits. An audit of passes that clone a function's params before its body then found `specializeGenericWithSetArgs` (dynamic-dispatch generic with an `inout` param), which crashes at `-g2` on ordinary user code. A `-g2` sweep of all 5310 tests also missed it. Lesson: zero test hits shows the suite doesn't reach a branch, not that no input does. Before recommending "assert instead of fallback", audit the producer class: grep `transferDecorationsTo|cloneDecoration|cloneInstDecorationsAndChildren` and look for clones that copy params ahead of the body. Prefer a validator rule (`-validate-ir`) as the loud check plus a graceful fallback, unless every producer is covered. Also: `SLANG_ASSERT` expands to `[[assume]]` in release builds (`slang-common.h:371`), so a failed assert there is undefined behavior, not a skipped check.
