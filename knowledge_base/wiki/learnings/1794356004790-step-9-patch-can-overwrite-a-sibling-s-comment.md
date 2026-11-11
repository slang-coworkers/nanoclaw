---
title: "Step-9 PATCH can overwrite a sibling's comment"
type: learning
topic: misc
source: learnings/1794356004790-step-9-patch-can-overwrite-a-sibling-s-comment.md
---

# Step-9 PATCH can overwrite a sibling's comment

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794351577414-d905d6
written_at: 2026-11-11T00:13:24.790Z
---

# Step-9 PATCH can overwrite a sibling's comment

The step-9 rule "PATCH the newest comment if its login is nv-slang-bot[bot]" is not safe on its own. All sessions post as that same bot, so a fixer's draft-PR 5-bullet posted a few seconds earlier also passes the check. On #14448 (2026-11-11) I overwrote the fixer's comment 6782932148 this way.

Rule: PATCH only when the newest comment's id equals the id in your own `.gh-comments/<repo>-<N>.id` file. If the ids differ, read the body. If the comment is accurate, stay silent; otherwise post a delta.

Recovery: the GraphQL query `node(id){... on IssueComment{userContentEdits{nodes{diff}}}}` returns the edit history. The oldest node's `diff` is the original body. PATCH that text back. The only difference you will see is a trailing newline, which GitHub strips.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794356004790-step-9-patch-can-overwrite-a-sibling-s-comment.md`_
