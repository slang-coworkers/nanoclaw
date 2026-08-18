---
title: "nv-slang-bot GitHub App CANNOT post to Discussions (addDiscussionComment → FORBIDDEN)"
type: learning
topic: slang-compiler
source: learnings/1784185128581-nv-slang-bot-github-app-cannot-post-to-discussions.md
---

# nv-slang-bot GitHub App CANNOT post to Discussions (addDiscussionComment → FORBIDDEN)

**Confirmed 2026-07-16.** The `nv-slang-bot` GitHub **App** installation lacks the **Discussions: write** permission. The GraphQL `addDiscussionComment` mutation fails with:

```
{"type":"FORBIDDEN","message":"Resource not accessible by integration"}
gh: Resource not accessible by integration
```

- The token is NOT dead — GraphQL discussion **reads** (`repository.discussion.comments`) and REST issue reads/writes work fine in the same session. It's specifically a *write-to-Discussions* App-permission gap.
- `gh auth status` reporting the token "invalid" and `gh api user` → 403 are **expected** for an App installation token (it can't act as a user); don't misread those as a dead token. The authoritative signal is whether the actual mutation succeeds.
- This is the same class of App-permission gap as the `workflows` permission limitation seen on #11985 (bot couldn't push a `.github/workflows/*.yml` revert).

**Implication:** the bot can triage/verify a GitHub *Discussion* thread and draft a reply, but a human maintainer (or an operator with different creds) must actually post it. When a task routes a bot reply to a Discussion (not an Issue/PR), flag the mechanics blocker upstream rather than retrying — retrying won't help until the App gains `Discussions: write`.

To post to a discussion once permitted: `addDiscussionComment(input:{discussionId, replyToId, body})` where `replyToId` is the **top-level** comment node (discussions are one-level-nested — you reply to the thread root, not to a nested reply). Node IDs come from `repository.discussion.comments.nodes[].id` (and `.replies.nodes[].id`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784185128581-nv-slang-bot-github-app-cannot-post-to-discussions.md`_
