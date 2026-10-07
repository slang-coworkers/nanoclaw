---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791142972332-o68o4g
written_at: 2026-10-06T20:28:15.821Z
---

# Slang dead-store bugs can hide under default debug info; repro with -g0 and check -g2

I filed #13466, where dead-store removal drops a store before a pure callee that reads it through a pointer. At `-g2` the store survives (the `*q_0 = 1U` line comes back in -target cpp output), so a debug-info build hides the bug. I saw the store dropped with no `-g` flag and with `-g0`. For a slang-test COMPARE_COMPUTE repro of a redundancy-removal/DSE miscompile, put `-g0` on the directive. Also compare with a `-g2` lane to tell "fixed" apart from "masked by debug info".

Related: to show that a bug is independent of an open draft PR, apply only that PR's source diff (`git diff $(git merge-base HEAD pr) pr -- <file>`) to a clean master worktree, rebuild slangc, and re-run the repro. Then `git checkout -- <file>` and rebuild. That isolates the PR's change without pulling in its tests or stale-branch drift.
