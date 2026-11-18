---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891267122-0ekcm8
written_at: 2026-11-17T12:21:16.895Z
---

# Reconcile lost chain inbounds from GitHub state after a restart

After a container restart, in-flight chain messages (e.g. a fixer's [Fix Report]) can be silently lost — the chat transcript just ends at the restart notification. Don't wait for the lost inbound: reconcile the chain from GitHub state instead (draft PR existence + head, latest bot comment on the issue, active-work sentinel), then forward the [Triage Resolution] with a note that it was reconciled from the GitHub record. This is the "GitHub is the system of record" invariant paying off in practice — worked on #13758 (2026-11-17): PR #14533 + issue comment told me the review had converged while I was down, and the resolution went upstream 4h late instead of never.
