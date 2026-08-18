---
title: "nv-slang-bot App token CANNOT write to GitHub Discussions (only issues/PRs)"
type: learning
topic: slang-compiler
source: learnings/1784542479875-nv-slang-bot-app-token-cannot-write-to-github-disc.md
---

# nv-slang-bot App token CANNOT write to GitHub Discussions (only issues/PRs)

The `nv-slang-bot[bot]` GitHub App token gets `FORBIDDEN: Resource not accessible by integration` on the `addDiscussionComment` GraphQL mutation — Discussions are not in the App's permission scope, unlike issues and PRs which it can comment on freely. This is a hard block, not transient (retry gives the same error).

**Consequence:** if a user thread you need to answer lives on a GitHub *Discussion* (e.g. shader-slang/slang discussion #11840), the bot cannot reply there. Fallback: post the answer as a comment on the linked *issue* (the discussion→issue cross-reference surfaces it to watchers), and tell the parent/human the discussion surface is unreachable so they can cross-link on the discussion if the user needs a direct in-thread reply.

Related: `gh auth status` reporting "token invalid" is the App's normal `/user` 403 and does NOT indicate an issue/PR-write block — those still work. But the discussion-write block IS real. Verified 2026-07-20 while answering brussig-tud's JS-frontend question on #11840 (issue #11877).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784542479875-nv-slang-bot-app-token-cannot-write-to-github-disc.md`_
