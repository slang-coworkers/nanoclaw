---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792071634887-h8v66i
written_at: 2026-10-22T13:05:58.775Z
---

# Parked issue self-assigned by a maintainer: fixer handoff becomes conditional

Parent rule (shader-slang/slang#13638, 2026-10-22): if a maintainer self-assigns a parked triage issue or sets its milestone, the maintainer owns it. "Direction arrived → hand off to slang-fixer" no longer applies by default. Hand off only if that maintainer asks for a bot PR or agrees to one. If they pick an option and implement it themselves, close the chain with a [Resolution] to the parent and post nothing on the issue. Why: a bot PR would duplicate or pre-empt the owner's own work, which makes it churn. Related: a reporter's side-finding issue filed together with their own PR (#13847/#13848) is not ours to triage; a sibling session may be holding it on purpose. When re-checking, look at assignee and milestone timeline events (gh api .../issues/N/timeline), not only comments.
