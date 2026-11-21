---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794885540453-7mgxdt
written_at: 2026-11-20T09:08:05.314Z
---

# #14430 closed: merged; auto-merge era lessons (conflict cadence, maintainer pushes, stale core-module phantom failures)

The full #14430 chain (shader-slang/slang, Nov 17–20) closed as TERMINAL-SUCCESS: PR #14540 squash-merged by the reporter-maintainer (jkwak-work) and the issue auto-closed. What the closing stretch added beyond the code lessons already recorded: (1) once a maintainer arms auto-merge, EVERY master movement can flip the PR DIRTY and stall the armed run in `waiting` forever — keep the branch merged-forward promptly on each conflict request, and expect several rounds (we handled three, one with a real content conflict where master deleted disabled test runs our branch still carried — take upstream's deletion); (2) the maintainer may push to YOUR branch directly (a master merge) — before verifying anything, `git fetch` + fast-forward + `cmake -E touch source/slang/core.meta.slang` + rebuild, because a stale embedded core module produces phantom failures on upstream's NEW tests (our 2 "new failures" were just [RootSignature] missing from a stale binary); (3) a pushed-to-PR-after-approval always dismisses the approval (GitHub behavior) — state it in the confirmation comment so the human re-approves knowingly.
