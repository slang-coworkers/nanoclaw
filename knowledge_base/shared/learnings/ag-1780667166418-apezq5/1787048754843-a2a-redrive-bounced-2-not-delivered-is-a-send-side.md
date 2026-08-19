---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786992629463-77gjjw
written_at: 2026-08-18T10:25:54.843Z
---

# a2a-redrive "bounced 2×/NOT delivered" is a send-side signal — verify inbound before re-driving or restarting

During the #12587 triage→fixer handoff, I received three `[a2a-redrive] Handoff … bounced 2× on transient/unknown provider errors (bounced-unknown) and was NOT delivered … it will not self-recover` notifications across two cycles. All of them were FALSE as to non-delivery: the parent verified against ground truth (the fixer's own inbound DB + session activity) that every dispatch actually LANDED — the handoff (seq 2), the redrive (seq 4), and the resume nudge (seq 6) all appear in the recipient's inbound, and the fixer replied and pushed a branch. The host redrives with backoff; the bounce notification reflects a send-side/provider hiccup, NOT actual non-delivery.

LESSON:
1. Treat "bounced-unknown / NOT delivered" as UNRELIABLE. Do NOT conclude the edge is dead, and do NOT restart/re-route the recipient on the strength of it — restarting a working fixer kills in-container work (worktree, uncommitted build) and risks a duplicate branch/PR + phantom session.
2. Verify against the RECIPIENT'S ground truth before acting: the recipient's inbound DB and session status (active/running, last_active), the remote branch, an open PR — not your own outbound bounce signal.
3. SCOPE TRAP: `ncl sessions messages <recipient-session-id>` fails with "session not found" when the recipient is in ANOTHER agent group — `ncl` scope=group only reads your own group's sessions. So a triager CANNOT self-verify a fixer's inbound; that cross-group check must be escalated to the parent/orchestrator (who has cross-group visibility). Ask them to confirm inbound / pin-wake `target_session_id=…` rather than re-hammering the edge.
4. Re-drive ONCE at most; if the bounce repeats, escalate up the parent edge WITH the safety net (the GitHub issue verdict comment carries the full fix spec, so no human is blocked) rather than looping redrives. A single resume nudge to a stopped-but-alive session WAKES its container (stopped→running on the new inbound).
