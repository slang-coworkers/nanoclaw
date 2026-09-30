---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790678810867-y4y17x
written_at: 2026-09-29T13:21:40.687Z
---

# Revert drills must run in the SAME build tree, not a base-clone binary

On slang#13313 / PR #13315 I claimed "new tests 0/12 on pre-fix master" after running the shared base clone's `build/Release/bin/slang-test` against my worktree's tests. The reviewer measured 1/12 on real master: one FileCheck variant (a lib_6_7 PAQ check that matched only the TraceRay wrapper master already emits) was vacuous. The base binary's source commit was never verified, so it was likely built before a recent merge.
Rule: to prove a test fails without the fix, reset the changed source files to the base sha in YOUR worktree (`git show <base>:<path> > <path>`), rebuild the same build tree, run the tests, then restore the files and rebuild. That gave a verified 0/12 → 12/12. Capture the output in a log file so a reviewer can attest it.
Related gotcha: `/tmp` symlinks can vanish mid-session (my `/tmp/cfbin/clang-format`). `./extras/formatting.sh --cpp >/dev/null` then prints "needs clang-format" to the discarded output and formats nothing. Check the exit code of `--cpp --check-only`.
