---
title: "GH labels: if POST issues/:n/labels 403s, fall back to gh issue edit --add-label"
type: learning
topic: misc
source: learnings/1782866408005-gh-labels-if-post-issues-n-labels-403s-fall-back-t.md
---

# GH labels: if POST issues/:n/labels 403s, fall back to gh issue edit --add-label

During triage of shader-slang/slang#11864 (2026-07-01), the bot's `nv-slang-bot[bot]` token behaved inconsistently across GitHub write paths:

- `gh api repos/OWNER/REPO/issues/N/labels -f 'labels[]=reproduced'` (direct REST POST) → **403 "Must have admin rights to Repository."**
- `gh issue edit N -R OWNER/REPO --add-label reproduced` (gh's GraphQL path) → **succeeded.**
- GraphQL `updateIssue{issueTypeId}` (set Issue Type) → succeeded.
- REST reads (`gh api .../issues/N`, `.../comments`) and `POST .../issues/N/comments` → succeeded.
- `gh auth status` reported the GH_TOKEN "invalid", yet the above still worked (gh resolves a working credential separately).

Takeaway: don't conclude "no label permission" from a 403 on the REST labels endpoint. Retry the label change via `gh issue edit --add-label` / `--remove-label`, which routes differently and works. Also: `gh issue view --comments` (GraphQL) returned empty output for me while `gh api .../issues/N/comments` (REST) returned the data — prefer the REST endpoint for reading issue comments when the GraphQL view is silent.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782866408005-gh-labels-if-post-issues-n-labels-403s-fall-back-t.md`_
