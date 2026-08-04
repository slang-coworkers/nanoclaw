---
title: "When gh GraphQL 401s, verify PR state and review-approval binding via REST"
type: learning
topic: review-process
source: learnings/1785752119095-when-gh-graphql-401s-verify-pr-state-and-review-ap.md
---

# When gh GraphQL 401s, verify PR state and review-approval binding via REST

## Symptom

`gh pr view <n> -R <repo> --json ...` and `gh issue view <n> --json ...` fail with:

```
HTTP 401: Bad credentials (https://api.github.com/graphql)
```

while plain REST calls with the *same* token succeed. Seen repeatedly on the
`nv-slang-bot` token (slang-rhi#805, slang#12313, slang#12317). The token is
scoped/limited such that the GraphQL endpoint rejects it but REST does not.

**Do not conclude "my token is dead" and skip verification.** Almost every
read you need for triage/close-out has a REST equivalent that still works.

## Substitutions that work

```bash
REPO=owner/name; N=806

# PR state (replaces `gh pr view --json state,isDraft,mergeable,...`)
gh api repos/$REPO/pulls/$N --jq '"state: \(.state)  draft: \(.draft)
head: \(.head.ref)@\(.head.sha[0:10]) -> \(.base.ref)
labels: \(.labels|map(.name)|join(","))
mergeable: \(.mergeable) / \(.mergeable_state)  merged: \(.merged)
files: \(.changed_files)  +\(.additions)/-\(.deletions)"'

# Files touched (replaces `gh pr diff --name-only`)
gh api repos/$REPO/pulls/$N/files --jq '.[]|"\(.filename)  +\(.additions)/-\(.deletions)"'

# Issue state + last commenter (for edit-in-place vs fresh-comment decisions)
gh api repos/$REPO/issues/$N --jq '"state: \(.state)  comments: \(.comments)"'
gh api repos/$REPO/issues/$N/comments --jq '.[-1]|"last: \(.user.login) id=\(.id)"'
```

Note `.draft` / `.mergeable_state` (REST, snake_case) vs `.isDraft` /
`.mergeStateStatus` (GraphQL, camelCase) — the field names differ.

## The one that matters most: is the approval STALE or does it BIND?

`gh pr view --json reviewDecision` is GraphQL and dies. But `reviewDecision`
alone never tells you whether the approval applies to the *current* head —
an approval sitting on an earlier commit is worthless. REST gives you the
stronger fact directly, because each review carries its `commit_id`:

```bash
gh api repos/$REPO/pulls/$N/reviews \
  --jq '.[]|"\(.user.login)\t\(.state)\tcommit=\(.commit_id[0:10])\t\(.submitted_at)"'
```

Approval **binds** iff `commit_id == .head.sha`. If they differ, someone
pushed after the approval and it no longer covers what would merge.

This is worth doing even when GraphQL is healthy — it's a strictly better
check than `reviewDecision: APPROVED`.

## Corollary: what actually breaks

REST covers comments (POST/PATCH), labels, PR/issue reads — so triage,
verdict posting, and close-out all still work. The real casualty is anything
that is GraphQL-only, notably **setting a native Issue Type** (`updateIssue`
with `issueTypeId`). When that's blocked, say so in the public comment and
flag it for a maintainer rather than silently omitting it.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785752119095-when-gh-graphql-401s-verify-pr-state-and-review-ap.md`_
