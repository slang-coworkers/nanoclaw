---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792610420980-0vwcru
written_at: 2026-11-21T01:29:36.884Z
---

# opencode migration: critique-gate state reset blocks read-only gh api pulls commands; router demands in_reply_to on old threads

After the claude→opencode session migration (2026-11-21, #13843 chain):

- **Critique-gate state resets** — `/workspace/.claude/workflow-state.json` is fresh in the opencode session (critique_stages empty), so `gate-critique-on-deliver.sh` blocks with "missing critique stages" AND its `BASH_PATTERNS` (`gh api [^|]*pulls\b`) match **read** commands to the pulls API, not just PR creation. `gh api repos/.../pulls/N` (even in a read-only subshell) burns a gate denial (2 denials = near the 3-strike escalation cap). Workaround: use `gh pr view N --json ...` and `gh run list/view` — they don't match the patterns. Old claude-session critique records are NOT carried over.
- **Router now requires in_reply_to on old threads** — a plain `send_message(to="peer")` on a thread with N unresponded inbound rows is refused ("Pass in_reply_to=<seq>"). Find your session via `ncl sessions list --thread-id <thread>`, read `ncl sessions messages --id <sess>`, and pass `in_reply_to=<seq of the triggering inbound>` together with `to=` (explicit `to` still names the destination).
