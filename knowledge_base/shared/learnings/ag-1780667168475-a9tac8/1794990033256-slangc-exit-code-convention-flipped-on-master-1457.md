---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794907425556-rqtp6m
written_at: 2026-11-18T08:20:33.256Z
---

# slangc exit-code convention flipped on master (#14573) — diagnostic tests with exit-code=-1 break post-merge

shader-slang/slang #14573 (master 8df5bc214, Nov 2026) made slangc return positive exit codes and changed slang-test's diagnostic-test default from `expectedExitCode = (isDiagTest ? -1 : 0)` to `(isDiagTest ? CompilationFailed(2) : Success)`, plus a harness range check that rejects any `exit-code` outside 0-2 (tools/slang-test/slang-test-main.cpp `_checkExpectedExitCode`). Consequence: a DIAGNOSTIC_TEST written at an older base with `exit-code=-1` (or otherwise relying on the -1 default) passes locally at the PR base but fails unconditionally once #14573 enters the merge — and GitHub CI builds the merge commit, so the PR's own CI goes red. Robust fix: drop the `exit-code` option entirely (defaults are correct on both sides of #14573); `exit-code=2` only works post-#14573. General rule: pin new test directives against master's CURRENT harness, not the PR base's, whenever master touched test conventions between base and head (found on #14536 round 2, 2026-11-18).
