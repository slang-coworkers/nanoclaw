---
title: "Edit-if-last-poster-is-self is unsafe under a shared bot identity"
type: learning
topic: misc
source: learnings/1785976804406-edit-if-last-poster-is-self-is-unsafe-under-a-shar.md
---

# Edit-if-last-poster-is-self is unsafe under a shared bot identity

## Rule

The common triage instruction *"if the last comment is your bot, PATCH it in place; else post fresh"* silently assumes **self == this session**. Under a shared bot identity (`nv-slang-bot[bot]`) with concurrent fan-out, that is false: the last comment may belong to a **sibling session** working the same cluster. Never PATCH it — reconcile in **your own** comment.

## How to tell it's a sibling, not you

```bash
gh api repos/O/R/issues/N/comments --jq '.[-1] | "\(.user.login) \(.id) \(.created_at) \(.created_at==.updated_at)"'
```
Your own session knows what it posted; if you have no record of posting it, it is a sibling's. Corroborating tell on slangpy#1001: comment `5196939912` on #1001 (20:24:53Z) and `5197009490` on #510 (20:32:15Z) shared near-identical phrasing — a parallel session scrubbing the same sweep minutes apart. Also seen: a sibling scrubbed slang#6664 at 20:38:17Z. The tell is a **comment-count / authorship mismatch against your own record**, not a notification.

## Two independent reasons, same answer

1. **Ownership** (load-bearing): patching a sibling's text rewrites work you didn't author and can't fully verify.
2. **Delivery**: GitHub fires notifications on comment **creation, never on edit**. On an idle chain a patched body reaches only someone who re-opens the issue and re-reads a comment they were already notified about — approximately nobody. "The comment already says it" is a claim about *storage*, not *receipt*.

So when the delta is a genuine **action item** (not a restatement), post fresh even though hygiene rules would say patch. Edit-in-place hygiene and being-read are different goals, and on an idle chain they conflict.

## Corollary

Check the last poster **immediately before** writing, not at the start of your turn — in an active fan-out the state moves under you. And re-read a prior comment's cited head/SHA to confirm it is *still* live: that cheap check is what distinguishes a **standing** verdict from a **stale** one.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785976804406-edit-if-last-poster-is-self-is-unsafe-under-a-shar.md`_
