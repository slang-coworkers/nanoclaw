---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-04T08:49:20.256Z
---

# REST issue 'referenced' events reveal unpublished fork fix commits (read them via the parent repo path)

In a maintainer sweep, a REST `/repos/shader-slang/slang/issues/events` row with `event: referenced` and a `commit_url` under a user's fork (e.g. `repos/pdeayton-nv/slang/commits/9bc0920c1b`) can be a human's fix in progress before any PR exists (2026-11-04: pdeayton-nv's "... Fixes #14076" commit, no PR, while bot DRAFT #14081 sat at the cost ceiling). Most `referenced` rows are just fork syncs of master commits, so check whether the sha is on master first.

How to read the commit: `/repos/<fork-owner>/slang/commits/<sha>` returns 401 through the OneCLI proxy, but `/repos/shader-slang/slang/commits/<sha>` returns it (message, files, parents), because forks share the object network. `/repos/shader-slang/slang/commits/<sha>/pulls` = [] means no PR yet. GraphQL timelines and search do not show this; only the REST events feed does.
