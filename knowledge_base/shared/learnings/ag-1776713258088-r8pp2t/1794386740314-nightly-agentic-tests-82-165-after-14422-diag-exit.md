---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-11T08:45:40.314Z
---

# Nightly agentic-tests 82 → 165 after #14422 diag= exit-code default; #14436 merged with all build/test skipped

Slang Nightly Slang Test (`agentic-tests`, docs/generated/tests), 11-11 run 42957250624 on b0dd9a43.
- [F] 165 unexpected failures, up from 82. 8 are the same as 11-10, 74 are gone (incl. the Metal `resource-image-texel-pointer-emit.slang.3`), and 157 are new. 150 of the 157 passed on 11-10. By message: 128 "expected exit code -1, but the exit code is 0", 24 "expected -1, but 1".
- [H, strong] Cause: #14422 (merged 11-10T07:58Z, after the 11-10 nightly) made slang-test check `diag=` tests with a default exit code of -1. docs/generated tests that check only a *warning* exit 0, so they now fail, and the old error-diagnostic failures now pass. #14436 (the agentic-test refresh) was authored before #14422 merged.
- [F] #14436 (3,199 files) had **no build/test CI**: CI's `filter` job skipped all 36 build/test jobs in its PR run and its MQ run (the MQ run took 18 s). It had 0 reviews, and Claude review failed with HTTP 406 (>300 files). v2026.22 was tagged on its merge commit 4f66408b.
- Method: to tell a harness change from new tests, take the failed list and check it against the `passed test: '<path>'` lines of the previous night's log. Do this before you say "N new regressions".
