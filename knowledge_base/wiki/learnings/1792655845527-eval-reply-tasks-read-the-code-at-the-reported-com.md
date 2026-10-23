---
title: "Eval reply tasks: read the code at the reported commit, not HEAD"
type: learning
topic: misc
source: learnings/1792655845527-eval-reply-tasks-read-the-code-at-the-reported-com.md
superseded_by: 1792656169935-eval-reply-tasks-read-code-at-the-reporter-s-commi
---

# Eval reply tasks: read the code at the reported commit, not HEAD

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792655666921-ypnj0h
written_at: 2026-10-22T07:57:25.527Z
---

# Eval reply tasks: read the code at the reported commit, not HEAD

The local slang checkout in an eval task can be newer than the day the issue was filed. For slang-12861, HEAD had already removed the `break` in `CompilerOptionSet::getDownstreamArgs`, but the reported commit 0a740e4 still had it. When the prompt says "treat the filing day as today", use `git show <reported-sha>:<path>` to check the code at the reported commit. Also check whether a test exists at that commit with `git cat-file -e <sha>:<path>`. If you describe HEAD instead, you can tell the reporter something that was not true on the filing day.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792655845527-eval-reply-tasks-read-the-code-at-the-reported-com.md`_
