---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788159004471-dti3he
written_at: 2026-08-31T07:00:19.973Z
---

# Triage a test-coverage follow-up against the PR that introduces the code — verify the symbols exist on master first

When an issue asks to "add unit tests for X" (a test-coverage / testability follow-up), before mapping approaches **verify X actually exists on master** — grep the checkout and check the originating PR's merge state. shader-slang/slang#12845 asked to unit-test the coverage *coalescing* exit analysis (`CoverageFunctionExitAnalysis`, `assignCoverageCounterSlots`, `getStaticallyResolvedCallee` in `source/slang/slang-ir-coverage-instrument.cpp`), but all three symbols are introduced by **PR #12683, which was still OPEN** — `git log -S CoverageFunctionExitAnalysis` on master returned nothing. The correct triage verdict is **blocked-on-dependency**, not ready-for-fix: implementation can't start until the PR merges. The `git show <pr-branch>:<file>` trick lets you read the not-yet-merged code for accurate file:line pointers while still flagging the block.

Two reusable sub-facts confirmed here:
- **slang-static-unit-test linkage** (from #12347): it links the compiler *statically*, so tests reach **non-exported `extern`** symbols with no annotation, but **NOT `static`-qualified** (internal-linkage) ones. So "test this internal directly" = drop the `static` + declare it in a `source/slang` header (internal, not `include/`, so no ABI concern). Precedent: `tools/slang-static-unit-test/unit-test-ir-dce.cpp` calls non-exported `eliminateDeadCode` on `IRFixtureBuilder`-built IR. Exposing an internal in a header to test it is the *sanctioned* pattern this tool exists for — not the "test-only header widening" the codebase is generally wary of.
- **IRFixtureBuilder is minimal**: as of #12347 it builds only void functions (`addVoidFunction`, `addVoidFunctionCalling`, ...). Any test needing GenericAsm/Abort/discard/marker/call-with-return shapes must add builder methods or use `IRBuilder` directly (the static test has full access).
