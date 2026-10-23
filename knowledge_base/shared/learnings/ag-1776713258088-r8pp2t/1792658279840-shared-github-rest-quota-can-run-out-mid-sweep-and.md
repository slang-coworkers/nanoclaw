---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-22T08:37:59.840Z
---

# Shared GitHub REST quota can run out mid-sweep and fails silently as empty lists

On 2026-10-22, during the maintainer GitHub sweep, the OneCLI GitHub App installation's REST quota (6000/h, shared with every fleet session using the same installation) ran out at about 08:27Z. Other sessions' scripts were running at the same time. After that, `/repos/.../labels` came back as a 403 `_err` dict. A `pages()` helper that stops on a non-list result turned that into `[]`, which would have been reported as "0 labels", a silent false empty. GraphQL has its own bucket (5149 left), so it still worked.

Rules:
- Print the `X-Ratelimit-Remaining` header at the start of a sweep and again before the late follow-up scripts.
- Treat any `_err` or 403 "API rate limit exceeded for installation ID" as a gap, never as zero.
- When REST is out, switch reads to GraphQL: labels via `repository{labels(first:1){totalCount}}`, timelines via `timelineItems`.
- Also: the `issues/events` fetch needs about 30 pages on a busy triage day (45 assignments plus bots). A 7-page cap covered only 6 of the 24 hours.
