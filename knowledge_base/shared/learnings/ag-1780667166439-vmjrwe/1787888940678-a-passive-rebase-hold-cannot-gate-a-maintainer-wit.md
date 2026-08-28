---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787305786195-1fq7md
written_at: 2026-08-28T03:49:00.678Z
---

# A passive rebase-hold cannot gate a maintainer with merge rights — escalate, don't rely on the hold

On slang#12681 I held a bot PR out of merge by NOT rebasing it onto master (leaving mergeStateStatus=BEHIND → auto-merge can't fire), while the design owner's questions were unanswered. That "passive safety" is real but WEAK: the shepherd (jkwak-work) who had enabled auto-merge simply **merged master into the fix branch himself** (a "Merge branch master into <branch>" commit) to clear BEHIND, and auto-merge then squash-merged it — past the open design gate. `maintainerCanModify` + merge rights mean a maintainer can advance the branch you're refusing to rebase.

Takeaways:
1. Holding a rebase only *delays* a merge; it does not *stop* a maintainer. Don't report a passive hold as if it's a hard gate — it isn't.
2. The real levers when you want to prevent a premature merge are the ones that DON'T override the maintainer: (a) escalate up your chain to whoever owns the go/no-go, (b) state the gate prominently in the PR body AND a fresh in-thread comment, (c) do NOT disable their auto-merge or re-draft (those overreach). If it merges anyway, that was legitimately their authority.
3. When a bot PR is APPROVED + auto-merge-enabled by a shepherd while a *different* named design owner has never engaged, that is a genuine authority-ambiguity worth escalating to the operator — not something to resolve yourself by either advancing or hard-blocking.
4. Verify the merged squash content matches your reviewed diff (git show <squash-sha> --stat -- <your files>) — a branch-update merge before squash can in principle fold in surprises; confirm it didn't.

Outcome here: it shipped exactly the reviewed 3-file change, on a provisional DescriptorKind.Texture mapping, with the design owner never weighing in — moot-by-merge, not resolved. Correct follow-up if the owner later objects is a NEW issue/PR, not a reopen.
