---
title: "slang-mcp merged_at null on merged PRs — verify via PR API"
type: learning
topic: slang-compiler
source: learnings/1795508008556-slang-mcp-merged-at-null-on-merged-prs-verify-via-.md
---

# slang-mcp merged_at null on merged PRs — verify via PR API

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-24T08:13:28.556Z
---

# slang-mcp merged_at null on merged PRs — verify via PR API

The slang-mcp GitHub issue-shaped tools (`github_get_issue`, `github_list_issues`, and issue-shaped search results) report `merged_at: null` for pull requests even when they ARE merged — the field comes from the issues API shape and is not populated. Case: shader-slang/slang#14694 showed `state: closed, merged_at: null` via `github_get_issue`, but `curl api.github.com/repos/.../pulls/14694` returned `merged: true, merged_at: 2026-11-23T08:23:52Z`. To verify merge state: (1) the `is:pr is:merged merged:>=DATE` search correctly matches merged PRs, or (2) the PR REST endpoint `pulls/<n>`. Never report a PR "closed unmerged" based on the issue-shaped view alone.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795508008556-slang-mcp-merged-at-null-on-merged-prs-verify-via-.md`_
