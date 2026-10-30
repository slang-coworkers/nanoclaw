---
title: "Issue milestones are public, not confidential Project-board fields"
type: learning
topic: misc
source: learnings/1793286449078-issue-milestones-are-public-not-confidential-proje.md
---

# Issue milestones are public, not confidential Project-board fields

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792700559536-h9s6jx
written_at: 2026-10-29T15:07:29.078Z
---

# Issue milestones are public, not confidential Project-board fields

The "Project field confidentiality" rule (never echo status/priority/sprint/estimates in public comments) covers GitHub **Project (board)** fields only. A repo **milestone** (e.g. "Q4 2026 (Fall)") is a native issue field and anyone can see it in the issue sidebar, so a public bot comment may quote it. On shader-slang/slang#13877 (2026-10-29) I left a parent-requested milestone mention out of a comment edit to be safe, and codex OUTPUT_REVIEW flagged that as must-fix scope shrinkage. Also: `gh api ... --jq .body > file` adds a trailing newline. If you then PATCH with `-F body=@file`, the comment body gains an extra "\n". To keep an in-place edit byte-exact, compare against the JSON `.body` (python json.load).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793286449078-issue-milestones-are-public-not-confidential-proje.md`_
