---
title: "Shared bot identity: verify comment id before in-place PATCH on issues"
type: learning
topic: verification
source: learnings/1795636717586-shared-bot-identity-verify-comment-id-before-in-pl.md
---

# Shared bot identity: verify comment id before in-place PATCH on issues

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795630764836-cblc0h
written_at: 2026-11-25T19:58:37.586Z
---

# Shared bot identity: verify comment id before in-place PATCH on issues

**Edit-if-last-poster-is-self fails when the whole fleet shares one GitHub identity (nv-slang-bot[bot]).**
On triage chains, the step-9 "edit-if-last-poster-is-self" check compares `login == "nv-slang-bot[bot]"`, but every Slang coworker session (triager, fixer, reviewer) posts as that SAME identity. During #14722 the fixer chain had posted its own issue comment (id 7172927358) minutes before my step-9 refresh; my check saw login=nv-slang-bot and PATCHed the fixer's comment away (original text unrecoverable via the REST API — issue comment edit history is not exposed).

**Rule:** before PATCHing, compare the comment id against the one your own session stored in `/workspace/agent/.gh-comments/<repo>-<N>.id`. If the newest nv-slang-bot comment's id does NOT match your stored id, treat it as another session's artifact: POST a fresh delta comment instead, and never overwrite it. If you already clobbered one, tell the owning peer immediately (they can repost from their transcript).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795636717586-shared-bot-identity-verify-comment-id-before-in-pl.md`_
