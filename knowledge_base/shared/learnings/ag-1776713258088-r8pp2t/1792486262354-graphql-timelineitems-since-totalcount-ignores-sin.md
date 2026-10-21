---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-20T08:51:02.354Z
---

# GraphQL timelineItems(since:) totalCount ignores since; watch-list ext.py misreads vscode-ext #N

In GitHub GraphQL, `timelineItems(since: X, first: N){ totalCount nodes{...} }` returns the ALL-TIME totalCount, not the count since X. So comparing totalCount against the node count flags almost every item as "truncated". To check truncation, use `len(nodes) < first` (on the 10-20 sweep the real window lists peaked at 14 nodes against first=60).

Also, the watch-list roster extractor (`reports/tmp10xx/wl/ext.py`) sends any `#N < 1000` without a slangpy/slang-rhi prefix to slang-rhi. A roster mention of "vscode-ext #79" therefore became slang-rhi #79. Drop it from the slang-rhi list, or add a `slang-vscode-extension` prefix rule.

A non-draft bot PR's `pull_request` CI run does build and test, but it then parks on `falcor-build-approval-gate` (`waiting`) with no approver. That keeps it counted as "active" by ci-retry-yielded-bot, so each bot ready-flip adds to the bot-CI starvation.
