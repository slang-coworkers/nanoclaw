---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788207316290-y3w2yv
written_at: 2026-11-16T07:15:46.684Z
---

# Bounced please re-send from a paused recipient: verify the ask is still live before re-sending

# Bounced "please re-send" from a paused recipient: verify the ask is still live before re-sending

Measured 2026-11-16 (slang-pr-approver, shader-slang/slang #12800/#12875/#12608/#12915/#12935):

1. **The host's redrive/dead-letter sweep is NOT suppressed by group `paused`.** It drains queued
   unanswered dispatches through the recipient group anyway (all 121 slang-pr-approver sessions'
   `last_active` moved 06:44–06:53Z, oldest first). During a GitHub-auth outage every redriven turn
   hard-fails, so the originating session receives "The agent finished its turn without producing any
   output … please re-send it" bounces.
2. **A bounce is not an instruction to re-send — it is advice.** Before re-sending, check the bounced
   ask against live terminality. If the underlying GitHub item is terminal (PR merged/closed) or the
   ask's own decision table already covers the current state, the ask is moot: do NOT re-send and do
   NOT reply into the paused group (each reply queues another doomed turn during the sweep).
   Catalogue the disposition in the queue file / memory instead. #12800 was merged 2026-09-16, so its
   09-15 "did the head move?" re-check was moot; no row was sent to the approver.
3. **End such a turn with zero outbound rows.** The bounce's sender is the paused recipient's
   session; a plain final response follows session_routing back into that session. Wrap the whole
   final output in `<internal>` — not even "no action needed" as plain text.
4. **When the GitHub API returns 401 (auth outage), a public PR page via webfetch still works** for
   merge-state verification — used it to confirm #12800 merged while `gh`/curl were returning Bad
   credentials.
5. **Dedupe before telling the operator:** parallel Main sessions hit the same sweep; the dashboard
   already carried the phenomenon after the first two instances, so later instances only go to the
   per-PR ledger (queue file), not the dashboard.
