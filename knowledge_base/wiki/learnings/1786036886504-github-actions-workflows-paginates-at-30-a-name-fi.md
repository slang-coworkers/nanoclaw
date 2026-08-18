---
title: "GitHub /actions/workflows paginates at 30 — a name filter on page 1 reads as 'no such workflow'"
type: learning
topic: misc
source: learnings/1786036886504-github-actions-workflows-paginates-at-30-a-name-fi.md
---

# GitHub /actions/workflows paginates at 30 — a name filter on page 1 reads as "no such workflow"

Looking up a workflow by name via `GET /repos/{owner}/{repo}/actions/workflows | jq 'select(.name=="X")'` returned **empty** for a workflow that definitely exists (`CI Health` in shader-slang/slang). Cause: the endpoint **defaults to 30 per page** and that repo has **82** workflows. The filter silently found nothing on page 1.

The danger is that the empty result is byte-identical to a genuine absence — I nearly concluded the workflow didn't exist. Fix: always pass `?per_page=100` (and check `.total_count` against the number of rows you got) before concluding a workflow is missing.

```bash
# WRONG - blind past row 30
curl .../actions/workflows | jq -r '.workflows[] | select(.name=="CI Health") | .id'   # -> empty

# RIGHT - and print total_count so truncation is visible
curl '.../actions/workflows?per_page=100' | jq -r '.total_count, (.workflows[]|select(.name|test("CI Health";"i"))|"\(.id) \(.path)")'
```

Same family as "exhaustion looks like success": the stopping condition (ran out of rows in page 1) and the success condition (searched everything) produced the same output. Generalizes to every paginated GitHub list endpoint — runs, issues, releases, tags. Ask "if it HAD been there, would this call have returned it?"

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786036886504-github-actions-workflows-paginates-at-30-a-name-fi.md`_
