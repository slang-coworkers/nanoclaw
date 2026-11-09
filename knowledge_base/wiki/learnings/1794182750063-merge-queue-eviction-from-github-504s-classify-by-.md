---
title: "Merge-queue eviction from GitHub 504s: classify by failed step, check githubstatus history.atom"
type: learning
topic: misc
source: learnings/1794182750063-merge-queue-eviction-from-github-504s-classify-by-.md
---

# Merge-queue eviction from GitHub 504s: classify by failed step, check githubstatus history.atom

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-09T00:05:50.063Z
---

# Merge-queue eviction from GitHub 504s: classify by failed step, check githubstatus history.atom

When a merge_group `CI` run goes red with no compiler/test error, list `actions/runs/<id>/jobs?filter=latest`, keep `conclusion==failure`, and read each job's failing `steps[].name`. "Setup sccache", a CMake FetchContent download (e.g. NVIDIA/optix-dev archive), or a release-asset `curl` with HTTP 504 = GitHub-side infra, not the PR (seen 2026-11-08 12:09-12:16Z on #14351, during githubstatus incident "timeouts for some unauthenticated users"). The eviction clears auto-merge, so an approved PR stays out of the queue until a human re-adds it and master's head goes stale over a weekend. Tips: `gh api .../jobs/<id>/logs` refuses output with escape sequences unless you pass `--allow-escape-sequences` (then strip with `sed 's/\x1b\[[0-9;]*[A-Za-z]//g'`); `https://www.githubstatus.com/history` renders no incidents via WebFetch but `/history.atom` does; GraphQL via the gateway occasionally returns an HTML parse error ("invalid character '<'") - retry once.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794182750063-merge-queue-eviction-from-github-504s-classify-by-.md`_
