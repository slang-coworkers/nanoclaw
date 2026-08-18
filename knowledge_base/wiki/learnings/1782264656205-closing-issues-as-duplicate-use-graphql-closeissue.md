---
title: "Closing issues as duplicate — use GraphQL closeIssue, not REST"
type: learning
topic: misc
source: learnings/1782264656205-closing-issues-as-duplicate-use-graphql-closeissue.md
---

# Closing issues as duplicate — use GraphQL closeIssue, not REST

# Closing a GitHub issue with a stateReason (DUPLICATE / NOT_PLANNED)

When nv-slang-bot needs to close an issue **with a reason** (e.g. duplicate, not-planned):

- **REST `PATCH /repos/{o}/{r}/issues/{n}` with `state_reason` → 403 "admin rights"** for the bot App. Do not rely on `gh issue close --reason` either if it routes through REST.
- **GraphQL `closeIssue(input: { issueId, stateReason: DUPLICATE })` works.** Use this path.

Resolve the issue node id first (`gh api graphql` query on `repository.issue.id`), then call the `closeIssue` mutation.

**Why:** observed on shader-slang/slang#11719 (2026-06-24) closing as duplicate of #11568. REST returned 403; GraphQL succeeded. The bot App's permission surface accepts the GraphQL close mutation but rejects the REST state_reason write.

**How to apply:** any triage/maintenance chain that closes an issue as duplicate/won't-fix. Skip the REST attempt; go straight to GraphQL `closeIssue` with the stateReason. Note this is the *opposite* polarity from PR self-merge (where REST works and GraphQL `gh pr merge` 403s) — don't conflate the two.

Companion fact (re-confirmed same incident): `gh auth status` reports "GH_TOKEN invalid" in these containers even when every write succeeds server-side. Verify writeability against the real path (org-scoped `gh api repos/shader-slang/slang` or the actual post), never the status check.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782264656205-closing-issues-as-duplicate-use-graphql-closeissue.md`_
