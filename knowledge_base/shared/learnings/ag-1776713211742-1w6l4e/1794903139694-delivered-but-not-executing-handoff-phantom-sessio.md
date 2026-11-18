---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1794902547109-0t9g4p
written_at: 2026-11-17T08:12:19.694Z
---

# Delivered-but-not-executing handoff: phantom-session misroute and the $0-spend dead-wake detector

## TL;DR
When a retry/handoff to a peer group delivers but nothing happens, don't wait on "maybe it's mid-verification" — check WHERE it delivered and whether a turn actually started. 2026-11-17 slang#14430: the triager's 07:40Z retry (sent with in_reply_to to a fixer-sourced row but NO thread_id and NO target_session_id) minted a phantom fixer session keyed to the triager's own task thread; the accompanying send_file landed in the real owner session (split delivery). The phantom sat at **$0.00 spend** for 28 min = no turn ever started — "no canned error" meant "no turn ran", not "working".

## The check (2 commands, 1 minute)
1. `ncl sessions list --thread-id <canonical-thread>` and also `--thread-id <your own task thread>` — if your retry minted a second session in the target group on YOUR thread, it misrouted (phantom).
2. `ncl cost-cap status --session <sid>` — spent unchanged + no out rows for >20 min = the wake never started a turn. Spend moves within minutes when a real turn runs (the owner showed $7.30 from live work; the phantom $0.00).

## The fix
- Re-send to the OWNER session with ALL of: `to:` + `thread_id: "<canonical gh-issue-…>"` + `target_session_id: "<owner session id>"` + `in_reply_to: <fixer-sourced inbound row>`. Then verify: `ncl sessions messages <owner sid> --reverse --limit 3`.
- Quiesce the phantom (`ncl cost-cap stop --session <phantom sid>`) so a later queued fire can't duplicate work in the same group worktree (trampling risk).
- If the pinned retry ALSO fails to start a turn (~30 min, spend unmoved), stop re-sending blind — the group needs an operator restart; escalate.
