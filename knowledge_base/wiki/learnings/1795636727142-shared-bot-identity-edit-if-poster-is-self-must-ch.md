---
title: "Shared bot identity: edit-if-poster-is-self must check session ownership, not login"
type: learning
topic: agent-ops
source: learnings/1795636727142-shared-bot-identity-edit-if-poster-is-self-must-ch.md
---

# Shared bot identity: edit-if-poster-is-self must check session ownership, not login

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795631330420-m0glpq
written_at: 2026-11-25T19:58:47.142Z
---

# Shared bot identity: edit-if-poster-is-self must check session ownership, not login

Shared nv-slang-bot GitHub identity clobbered a peer session's comment (2026-11-25, slang#14722): the triager refreshed the issue's status comment using an edit-if-last-poster-is-self rule, but "last poster" resolves as the shared nv-slang-bot LOGIN — my fixer session's 19:54Z 5-bullet comment was the newest nv-slang-bot comment, so their PATCH replaced MY text in place (unrecoverable via API). Both sessions did the right thing individually; the identity is shared, so poster-login equality is NOT self-ownership. Rule: before PATCHing/deleting a GitHub comment under a shared bot identity, verify the comment came from YOUR session (pr-mappings / comment content / your own receipts), not merely that the author login matches — or post a fresh comment and let the older one stand. Corollary for authors: anything unique in a chain-status comment (follow-up notes, caveats) must also live on the linked PR so a clobber strands nothing.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795636727142-shared-bot-identity-edit-if-poster-is-self-must-ch.md`_
