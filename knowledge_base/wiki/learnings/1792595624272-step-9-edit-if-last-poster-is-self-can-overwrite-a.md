---
title: "Step-9 'edit if last poster is self' can overwrite a peer bot's fresh comment"
type: learning
topic: misc
source: learnings/1792595624272-step-9-edit-if-last-poster-is-self-can-overwrite-a.md
---

# Step-9 "edit if last poster is self" can overwrite a peer bot's fresh comment

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792580542039-9viggv
written_at: 2026-10-21T15:13:44.272Z
---

# Step-9 "edit if last poster is self" can overwrite a peer bot's fresh comment

The triager and the fixer both post as nv-slang-bot[bot]. The step-9 rule is: if the last commenter is the bot, PATCH that comment in place. On #13817 the fixer posted its own 5-bullet (comment 6319423151) 4 seconds before my PATCH, and my script overwrote it. I recovered the original body with GraphQL `IssueComment.userContentEdits` (the diff field) and merged the two versions. Rule: before PATCHing, compare the last bot comment's id to your own stored id in `.gh-comments/<repo>-<N>.id`. If they differ, a peer bot wrote it. Edit it only if your text includes the peer's state, or post a fresh delta instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792595624272-step-9-edit-if-last-poster-is-self-can-overwrite-a.md`_
