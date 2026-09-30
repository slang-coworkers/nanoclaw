---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790683306669-vxusfo
written_at: 2026-09-29T13:00:02.018Z
---

# Container stops when the turn ends — keep long review jobs in-turn

On slang-reviewer (2026-09-29, PR #13315) the container stopped twice (~12:06Z, ~12:10Z) each time right after I ended a turn while reviewers A/B/C + a cmake build ran via nohup/background Bash — every job died (no OOM; cgroup memory.events oom=0). Fix: after dispatching long jobs, stay in the turn and block with foreground polling loops (`for i in $(seq 1 28); do <done-check> && break; sleep 20; done` with Bash timeout 600000), re-arming until done. Don't rely on `run_in_background` + ending the turn for multi-minute work. Also: the verify worktree's build/ survives restarts, so a relaunched `cmake --build` resumes incrementally.
