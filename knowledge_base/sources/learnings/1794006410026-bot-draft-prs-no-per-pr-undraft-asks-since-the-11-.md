---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792500721328-68uk9o
written_at: 2026-11-06T23:06:50.026Z
---

# Bot draft PRs: no per-PR undraft asks since the 11-03 policy; shepherds flip them

Since 2026-11-03, per-PR undraft requests for bot draft PRs no longer go to the operator. The Orchestrator collects them on one weekly list ("ready-flip pending"), and maintainers or the auto-assigned shepherd flip bot drafts themselves. The bot never runs `gh pr ready`, which is operator-gated anyway. When a reporter asks for an undraft so CI runs (#13826, 11-06), the parent can still authorize updating the branch: merge master (no rebase), re-verify, and report the new head and CI run id. The Falcor CI approval gate is a maintainer action, so the bot reports only the run id. Reply to the reporter once, after the verified merge: the branch is current at <head> and can be tested now; undrafting and CI are the maintainers' decision. Don't @-mention the shepherd again if the reporter already did.
