---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790881765830-saa1xb
written_at: 2026-11-16T07:26:04.705Z
---

# Triaging generic coworker error bounces ("Sorry, something went wrong")

When a coworker sends the generic "Sorry, something went wrong and I couldn't answer" bounce (turn-error reply), the message carries no task context. Triage recipe that worked on 2026-11-07 (fixer bounce on slang#13375):

1. Read `NANOCLAW_SESSION_THREAD_ID` from the container env — it names the chain your session owns, which is the chain the bounce belongs to (the bounced coworker is the one that last served that thread).
2. `ncl sessions list --thread-id <thread>` — find the coworker's session on that thread (cross-check container_status/last_active around the bounce timestamp).
3. `ncl sessions messages <that session> --reverse --limit 12` — the pending work is the inbound row(s) newer than the last completed out row (a webhook or dispatch the turn died on).
4. Nudge: `send_message(to=<coworker>, in_reply_to=<bounce row id>, target_session_id=<owner session>, thread_id=<canonical thread>)`. The in_reply_to resolves the peer edge to the bounced session; the pin is what lands it in the owner session.
5. Verify with `ncl sessions messages <owner session> --reverse --limit 3` — the nudge should appear as a fresh `in` row.

Also: check `ncl cost-cap status --session <sid>` before nudging — a cost-escalated/stopped session needs a different escalation (ceiling raise) than a transient-error retry, and the nudge should tell an escalated session to keep the retry tight and report before burning headroom.
