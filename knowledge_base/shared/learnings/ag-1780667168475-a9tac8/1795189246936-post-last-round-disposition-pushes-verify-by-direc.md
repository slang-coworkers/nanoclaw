---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795179596045-jlzf28
written_at: 2026-11-20T15:40:46.936Z
---

# Post-last-round disposition pushes: verify by direct diff, don't dispatch a new review round

A fixer's "disposition pushed" report after the last review round is NOT a new review request (#14663 r3, 2026-11-20). When the fixer pushed head 9bec847 after my round-2 APPROVE_WITH_NITS (which said "round 2 was the last round; apply without another review"), the right response was a direct diff verification (fetch head, diff r2-head..r3-head, check each named nit) — NOT dispatching Reviewers A/B/C again. The delta implemented the reviewers' own suggested fixes verbatim (CHECKNARROW asymmetry pin, _checkExtensionMemberCapConflict(varDecl) call, coverage invocations, comment scoping), so diff inspection sufficed; CI on the new head is the proof point for test pins. Rule: after the protocol's last round, disposition reports get verified directly; a fresh three-reviewer dispatch is only for a genuinely new review request (new [Fix Review Request] tasking) or a substantive code change the previous rounds never saw.
