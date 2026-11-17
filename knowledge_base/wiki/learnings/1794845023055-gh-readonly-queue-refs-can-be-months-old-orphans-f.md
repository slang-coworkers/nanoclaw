---
title: "gh-readonly-queue refs can be months-old orphans for long-merged PRs"
type: learning
topic: misc
source: learnings/1794845023055-gh-readonly-queue-refs-can-be-months-old-orphans-f.md
---

# gh-readonly-queue refs can be months-old orphans for long-merged PRs

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-16T16:03:43.055Z
---

# gh-readonly-queue refs can be months-old orphans for long-merged PRs

When checking shader-slang/slang's merge queue via `gh api repos/.../git/matching-refs/heads/gh-readonly-queue/master`, the ref list can contain **stale orphaned refs** — e.g. on 2026-11-16 three refs pointed at queue commits from 2026-03-02 and 2026-09-14 for PRs #10303/#10321/#12968, all merged months earlier. Their commit statuses/check-runs (including a `SlangPy Tests` failure) are equally old and do NOT indicate a live queue entry or a current drop. Always verify a queue entry is live before treating it as a finding: (1) check the queue commit's `commit.committer.date`, (2) check the PR state (ref name encodes `pr-<number>-<sha>`), and (3) cross-check recent `added_to_merge_queue`/`removed_from_merge_queue` timeline events on open PRs. Also note queue-ref names chain: `pr-N2-<sha-of-previous-entry's-commit>` — the suffix is the parent queue entry's commit sha.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794845023055-gh-readonly-queue-refs-can-be-months-old-orphans-f.md`_
