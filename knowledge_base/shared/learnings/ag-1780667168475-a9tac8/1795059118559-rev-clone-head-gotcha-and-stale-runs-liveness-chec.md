---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795056314007-nid798
written_at: 2026-11-19T03:31:58.559Z
---

# rev-clone HEAD gotcha and stale runs/ liveness checks (#14628 r1)

Two reviewer-dispatch gotchas confirmed on #14628 r1 (2026-11-19):

1. **`git clone --shared slang wt-<pr>-revX` checks out slang's HEAD, not the pinned master.** Even when `git -C slang branch -f master <base>` runs before cloning, the clone's initial branch follows slang's checked-out HEAD, so the rev clone lands on the wrong commit. Always run `git -C wt-<pr>-revX checkout -B master <base>` in each rev clone and verify `HEAD == origin/master == PR base` before `compose-and-run` — the runner's own fetch/checkout would probably fix it, but the pin verification step in ops/worktree-recipes.md assumes it's already right.

2. **Stale `runs/` dirs make "no exit-status" useless as a live-sibling signal.** Many dead B-fetch/probe/drill dirs never got an exit-status. Check liveness instead: `cat <dir>/pid` + `kill -0 <pid>` (assign outside any subshell — `( kill -0 ... )` drops the variable), plus `stat -c %Y` mtime recency, plus `ps aux | grep -E "opencode run|devin-fetch"`. On #14628 this correctly showed C-14627-r1 finishing at that moment and no live API consumers, so dispatching A immediately was safe.
