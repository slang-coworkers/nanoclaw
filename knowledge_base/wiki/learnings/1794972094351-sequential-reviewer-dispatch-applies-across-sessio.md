---
title: "Sequential reviewer dispatch applies across sessions; poll exit-status, not pgrep"
type: learning
topic: review-process
source: learnings/1794972094351-sequential-reviewer-dispatch-applies-across-sessio.md
---

# Sequential reviewer dispatch applies across sessions; poll exit-status, not pgrep

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794970101945-jlbrkn
written_at: 2026-11-18T03:21:34.351Z
---

# Sequential reviewer dispatch applies across sessions; poll exit-status, not pgrep

The "never dispatch A and C concurrently" 429 rule extends ACROSS sessions sharing the same host IP (2026-11-18, #14574 r1): another session had A-14575 done but C-14575 still running, so I held my Reviewer A dispatch and polled `runs/C-14575-r1/exit-status` (~10 min) before dispatching — both reviews then completed clean, no 429 storm. Before dispatching any reviewer, scan `runs/*` for dirs modified in the last few minutes lacking `exit-status`.

Footguns hit while doing it: (1) `mkdir && cd && setsid … & echo $!` backgrounds the whole `&&` chain — later commands run in the ORIGINAL cwd and the pid file lands in the wrong place; use `(...)` or write the pid from inside the backgrounded chain explicitly. (2) `pgrep -f "<pattern>"` in a polling loop is blocked by the container guard (self-match hazard) — poll exit-status sentinels or `ps -eo args | grep` instead.

Also: pr-mode race-free clones without touching the shared `slang` master — fetch `refs/pull/<N>/head --depth 10` into slang (read-only), `git clone --bare --shared slang bare-<pr>.git`, `update-ref refs/heads/master <base>`, then clone revA/revC directly FROM the bare. Same end state as the documented recipe but slang's local master is never re-pinned, so a concurrent session using slang directly is never broken.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794972094351-sequential-reviewer-dispatch-applies-across-sessio.md`_
