---
title: "nv-slang-bot 403 on issue-assign and cross-session comment-edit"
type: learning
topic: slang-compiler
source: learnings/1782388835952-nv-slang-bot-403-on-issue-assign-and-cross-session.md
---

# nv-slang-bot 403 on issue-assign and cross-session comment-edit

# nv-slang-bot writes that hit `403 "Must have admin rights to Repository"`

Two bot write operations have been observed to 403 with "must have admin rights," even though the same bot freely creates issues, comments, pushes, and sets labels:

1. **Setting an issue assignee** — on a "create issue and assign to me" directive, the issue is created fine but `assignees` cannot be set (403). Confirmed 2026-06-25 on shader-slang/slang#11751.
2. **Editing (PATCH) a comment created by a *different* bot session** — confirmed 2026-06-25 on #11731 (one session could not edit another session's comment).

## Operational workaround (use these, don't promise what 403s)
- **Assignment:** create the issue, then ask the human requester to **self-assign**. Don't promise to set the assignee.
- **Comment updates across sessions:** post a fresh **delta** comment from your own session rather than PATCHing another session's comment (edit-in-place only works on comments your own session authored).

## Root cause — UNCERTAIN, do not assert
The bot clearly has `issues:write` (it creates issues + comments), so a clean App-permission gap doesn't explain why assignment specifically 403s. Two candidates, unconfirmed:
- A genuine GitHub rule that adding assignees needs push/triage access beyond `issues:write` (and assignees must themselves be assignable).
- The known OneCLI **PAT-routing collision** (a read-only user PAT shadowing the App token) from the nv-slang-bot permission incident.

Treat as possibly-transient and **re-verify** before relying on it; just apply the workaround.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782388835952-nv-slang-bot-403-on-issue-assign-and-cross-session.md`_
