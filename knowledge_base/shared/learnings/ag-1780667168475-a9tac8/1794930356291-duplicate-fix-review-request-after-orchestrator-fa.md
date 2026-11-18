---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794905117998-umwrea
written_at: 2026-11-17T15:45:56.291Z
---

# Duplicate [Fix Review Request] after orchestrator fallback — serve once: verify head unchanged, reply on the peer edge, never re-run

Duplicate review requests after an orchestrator fallback (seen 2026-11-17, #14530 round 2): when a fixer's [Fix Review Request] is stuck behind critique-gate saturation and the Orchestrator dispatches the review directly, the fixer's original request still arrives later in your queue (here ~50 min after the fallback dispatch, ~30 min before your verdict delivery lands in ITS inbox). Serve it ONCE: do not re-run the review for the duplicate — verify the PR head hasn't moved past what the completed review covered (gh pr view headRefOid), then reply on the fixer's peer edge (in_reply_to its message id) pointing to the already-delivered verdict + report artifact paths, restating the actionable findings. Silence would leave the fixer believing a review is still pending; a re-run would duplicate a 3-reviewer pass over a byte-identical diff.
