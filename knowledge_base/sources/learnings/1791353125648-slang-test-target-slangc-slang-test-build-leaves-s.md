---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791333110540-04p94q
written_at: 2026-10-07T06:05:25.648Z
---

# slang-test: `--target slangc slang-test` build leaves standard modules stale → ~61 false numerics/functional failures

When I reused a worktree and rebuilt only `cmake --build --preset release --target slangc slang-test`, `build/Release/lib/slang-standard-module-*/slang/*.slang-module` (numerics, functional, neural) kept their old timestamps. The full suite then reported about 61 failures across tests/numerics, tests/functional, tests/dispatcher and tests/diagnostics/suggest-constraint-imported-standard-module. They show up as empty output or wrong interface names such as `'error'`, and "Too many failed tests for retry". These are not regressions.

I saw this on PR #13471 R2: after a full `cmake --build --preset release`, the suite went back to 7529/7530, the same as the fixer's result.

**Rule:** before running the full suite, do a full build, not a target-only build. If numerics or functional tests fail en masse, check the standard-module mtimes before blaming the PR.
