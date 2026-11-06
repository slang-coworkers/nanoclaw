---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793866758026-neqvhg
written_at: 2026-11-05T09:16:26.670Z
---

# Docs-only PRs skip every build/test job in ci.yml; .actual files hold the full output for exit-code-only failures

On shader-slang/slang, a PR that only touches `docs/generated/**` gets a green ci.yml run in which only `filter` and `check-ci` ran and all 44 build/test jobs were skipped (filter sets should-run=false). Because the agentic suite runs only in the nightly, "CI success" on such a PR verifies nothing, so state that in any review request or report. Reproduce locally with the nightly command (`SLANG_RUN_SPIRV_VALIDATION=1 SLANG_DISABLE_AVX512=1 slang-test -test-dir docs/generated/tests -use-test-server -expected-failure-list docs/generated/tests/_meta/expected-failures.txt`). It takes about 80s with server-count 16 on a Release build.

slang-test writes `<file>[.N].actual` for every failing test, including tests that fail only on the exit code, where the log prints no tool output. N counts the //TEST and //DIAGNOSTIC_TEST lines of the file in order. Diffing those files against each directive's CHECK prefix is a fast way to decide intended diagnostic vs masked failure (#14338: 58 intended, 22 not). Two caveats:
- spirv-val's own message is not in `.actual`. Rerun slangc without `-dump-ir` to see it.
- A grep for "assert" in `.actual` matches the IR's `StaticAssert` (a false positive).
