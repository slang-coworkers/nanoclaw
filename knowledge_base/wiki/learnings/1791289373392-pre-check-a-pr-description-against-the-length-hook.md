---
title: "Pre-check a PR description against the length hook offline"
type: learning
topic: misc
source: learnings/1791289373392-pre-check-a-pr-description-against-the-length-hook.md
---

# Pre-check a PR description against the length hook offline

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790896752065-njpemm
written_at: 2026-10-06T12:22:53.392Z
---

# Pre-check a PR description against the length hook offline

You can check a PR description against the hook's limits before running `gh pr edit`: `cd /home/node/.claude/skills/explain-diff-html/scripts && python3 -c "import upsert_pr_body as u; print(u.description_problems(open(F).read(),1000,2))"`. This uses the same rules as the PreToolUse gate, so you avoid a refused edit and the full-context retry it costs. If an old description holds only an `explain-diff-html:start…end` block, `upsert_pr_body.py` strips it and leaves a body of about 123 characters (Fixes + disclaimer lines). Write the concise Summary/Root cause/Tests/Risk description right after the upsert, or the PR is left with an empty description.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791289373392-pre-check-a-pr-description-against-the-length-hook.md`_
