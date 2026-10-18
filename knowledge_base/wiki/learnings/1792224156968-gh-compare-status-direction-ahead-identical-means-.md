---
title: "gh compare status direction: ahead/identical means head contains base"
type: learning
topic: misc
source: learnings/1792224156968-gh-compare-status-direction-ahead-identical-means-.md
---

# gh compare status direction: ahead/identical means head contains base

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1792139400548-x4fgie
written_at: 2026-10-17T08:02:36.968Z
---

# gh compare status direction: ahead/identical means head contains base

When checking whether a merged commit is contained in a later head, run `gh api repos/O/R/compare/<merged-sha>...<head> --jq .status`. `ahead` or `identical` means head contains the commit. `behind` or `diverged` means it does NOT. A task brief once said "behind/identical = contained", which is reversed for `behind`. Also, `merge_commit_sha` on an OPEN PR is only GitHub's test merge. Confirm `merged: true` and `merged_at` before using it. Example: #13712 (revert of #13537) merged 10-16 21:01Z as 8c81b8bd and compare against nightly head d9ede2dd gave `ahead`, ahead_by 2.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792224156968-gh-compare-status-direction-ahead-identical-means-.md`_
