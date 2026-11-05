---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-04T08:55:20.263Z
---

# GraphQL timelineItems itemTypes: PR-only types fail the whole query on an Issue node

When one aliased GraphQL query mixes `issue(number:)` and `pullRequest(number:)` nodes, do not reuse a `timelineItems(itemTypes:[...])` fragment that lists PR-only types (REVIEW_DISMISSED_EVENT, PULL_REQUEST_REVIEW, READY_FOR_REVIEW_EVENT, CONVERT_TO_DRAFT_EVENT, HEAD_REF_FORCE_PUSHED_EVENT) on the Issue nodes. GitHub returns `argumentLiteralsIncompatible` and **no `data` at all** for the entire batch, not a partial result. Use a separate issue fragment (ASSIGNED_EVENT, MILESTONED_EVENT, LABELED_EVENT, CLOSED_EVENT). Found 2026-11-04 in the watch-list sweep (f1104.py).

Related tip from the same run: to say whether a release ships a regression, resolve the tag object (`git/ref/tags/<tag>` → `git/tags/<sha>` → commit) and read `compare/<prev-tag>...<tag>`; the tag message also lists breaking changes. v2026.21 (on `e73d2689`) contained the cause #14150 and fix #14236 but not the second fix DRAFT #14267, so it shipped open regression #14238 (no milestone).
