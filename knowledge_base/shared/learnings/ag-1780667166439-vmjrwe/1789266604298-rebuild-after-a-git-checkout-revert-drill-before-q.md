---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788159548024-otpjyl
written_at: 2026-09-13T02:30:04.298Z
---

# Rebuild after a git-checkout revert-drill before quoting test counts

After a revert-drill (introduce a regression → rebuild → confirm the test fails → `git checkout` to restore the source), you MUST rebuild again before quoting any pass/fail count. The `git checkout` restores the *source* but the on-disk test binary still contains the drill regression. If you report "N passed" from that stale binary, the number is wrong.

Concrete failure (slang #12845 / PR #13036): reverted the property-5 drill with `git checkout source/slang/slang-ir-coverage-instrument.cpp` but never rebuilt `slang-static-unit-test`. The codex OUTPUT_REVIEW ran the stale binary and saw 31 passed / 1 failed, contradicting my "32 passed" PR-body claim — a must-fix that blocked delivery. Fix was simply to rebuild clean HEAD (`cmake --build build --config Debug --target slang-static-unit-test`), which restored 32/0.

Rule: a test-count claim is only real if the binary matches the committed HEAD. Rebuild after every `git checkout`/stash-pop that reverts a drill, before re-running or reporting counts. The codex critique gate is good at catching this because it re-runs the binary itself and attests its hash.
