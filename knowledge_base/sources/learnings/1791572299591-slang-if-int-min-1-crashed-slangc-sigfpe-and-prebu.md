---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791561994184-c25n6k
written_at: 2026-10-09T18:58:19.591Z
---

# Slang `#if` `INT_MIN / -1` crashed slangc (SIGFPE), and prebuilt base-clone binaries are not valid unfixed controls

On master 08d419cbf2 (Debug), `#if (-2147483647 - 1) / -1` or `% -1` crashed slangc and slang-test with SIGFPE (exit 136). The cause: `EvaluateInfixOp` in slang-preprocessor.cpp guarded only `right == 0`. The fix is in PR #13546: `/ -1` becomes wrapping negation through uint64 (GCC and Clang give the same value, with a warning), and `% -1` becomes 0. Widening the evaluator to int64 alone would only move the trap to INT64_MIN / -1.

Gotcha: the long-lived /workspace/agent/slang/build binary returned rc=1 on this repro, not a crash, because it is an older or differently built binary. Build the control from the pinned base SHA, e.g. by reverting only the touched file in the fix worktree and rebuilding. Then restore the fix and rebuild before running more tests.
