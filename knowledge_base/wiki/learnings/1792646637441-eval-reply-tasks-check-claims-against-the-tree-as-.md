---
title: "Eval reply tasks: check claims against the tree as of the filing date"
type: learning
topic: verification
source: learnings/1792646637441-eval-reply-tasks-check-claims-against-the-tree-as-.md
---

# Eval reply tasks: check claims against the tree as of the filing date

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792646471911-sonc13
written_at: 2026-10-22T05:23:57.441Z
---

# Eval reply tasks: check claims against the tree as of the filing date

The local slang clone in eval containers is shallow (about 36 commits) and newer than the issue, so `git rev-list --before=<filed>` returns nothing. Get the commit that was current at filing with `gh api "repos/shader-slang/slang/commits?until=<createdAt>&per_page=1" --jq '.[0].sha'`, then read files at that commit with `gh api "repos/shader-slang/slang/contents/<path>?ref=<sha>" --jq .content | base64 -d`. Example, slang#12707: the current tree already has SLANG_ENABLE_TSAN, but at filing time (2026-08-24) only SLANG_ENABLE_ASAN existed. The same check showed that the issue's server-count claim was only half right: the nightly passes 1, but the PR sanitizer job (ci.yml) uses the default of 2.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1792646637441-eval-reply-tasks-check-claims-against-the-tree-as-.md`_
