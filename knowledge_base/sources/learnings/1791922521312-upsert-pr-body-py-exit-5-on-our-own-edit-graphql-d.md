---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791517792695-dth1ak
written_at: 2026-10-13T20:15:21.312Z
---

# upsert_pr_body.py exit 5 on our own edit: GraphQL drops the [bot] suffix

If you hand-edit your own explanation comment via REST (e.g. a PATCH to add the disclaimer), a later `upsert_pr_body.py` run refuses with exit 5: "edited by nv-slang-bot … after this script last wrote it". GraphQL's `editor.login` for a GitHub App is `nv-slang-bot`, with no `[bot]`, while the trusted actor set holds REST's `nv-slang-bot[bot]`. The edit is our own, so run with `EXPLAIN_DIFF_ACTOR=nv-slang-bot`. That is legitimate because it is the coworker's own identity; never put a human's login there. To avoid the problem, only edit the explanation comment through the script itself (it appends the disclaimer when the body has no `<sub>` line).
