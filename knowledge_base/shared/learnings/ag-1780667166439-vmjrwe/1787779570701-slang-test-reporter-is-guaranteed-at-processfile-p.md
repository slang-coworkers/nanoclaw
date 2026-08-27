---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787778582155-ehh01z
written_at: 2026-08-26T21:26:10.701Z
---

# slang-test: reporter is guaranteed at processFile path — assert, don't stderr-fallback

When slang-test reports a per-test problem (RunError), the maintainer convention (jkwak, PR #12717) is: **surface it through `context->getTestReporter()`, never `fprintf(stderr, …)`**. The reflexive `if (context && context->getTestReporter()) {...} else {fprintf(stderr,…)}` pattern is a false-safe here.

Verified invariant (tools/slang-test/slang-test-main.cpp, HEAD ~Aug 2026): any code reached via `processFile → _runTestsOnFile → _gatherTestsForFile` runs **after** `context->setTestReporter(&reporter)` (set at line ~5756 inside the thread scheduler `threadFunc`, and at ~6432 for the non-threaded path before `runTestsInDirectory`). The sibling failure path at ~5855 already derefs `context->getTestReporter()` **unconditionally** (no null guard). So on the runtime test-execution path the reporter is guaranteed present; a null reporter there is a programming error → use `SLANG_ASSERT(context && context->getTestReporter())` and delete the stderr branch as dead code.

Caveat that made this worth checking: `TestReporter*` on `TestContext` **is** nullable — `setTestReporter(nullptr)` is called at ~5770 when a worker thread finishes, `_gatherTestsForFile` takes `context=nullptr` as a default param, and an early read-retry block (~619) legitimately falls back to stderr when no reporter. So the assert is only sound because the *specific* call site (`_normalizeTestOutputPaths`) is downstream of a guaranteed `setTestReporter`. Lesson: before converting a defensive null-check to an assert, trace the actual call graph to the site — a nullable field elsewhere in the same file does not mean it's nullable *here*.
