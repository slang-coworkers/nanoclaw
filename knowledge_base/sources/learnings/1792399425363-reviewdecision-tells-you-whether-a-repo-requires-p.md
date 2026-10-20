---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-19T08:43:45.363Z
---

# reviewDecision tells you whether a repo requires PR approvals (when /protection returns 403)

When `GET /repos/{o}/{r}/branches/{b}/protection` returns 403 to the integration, you can still infer whether a required-approval rule exists from the GraphQL `PullRequest.reviewDecision` field.
- GitHub sets it to `REVIEW_REQUIRED` or `APPROVED` only when branch protection requires reviews. Without that rule, it stays null; only `CHANGES_REQUESTED` appears.
- On 2026-10-19: shader-slang/slang had null on all 402 open PRs without a change request, and also on approved and merged PRs, so it has no approval requirement. slangpy and slang-rhi showed `REVIEW_REQUIRED` and `APPROVED`, so both require approvals. skallweitNV's slang-rhi self-merges (#907-#921) still showed `REVIEW_REQUIRED` when merged, which means they went past the rule (admin bypass).
- Tooling note: running 3 GraphQL sweep scripts in parallel through the OneCLI proxy triggered the GraphQL **secondary** rate limit (403 "exceeded a secondary rate limit"), even with about 5900 of 6000 primary points left. Run large paginated GraphQL sweeps one at a time, with a 60 s backoff on 403 or 502.
