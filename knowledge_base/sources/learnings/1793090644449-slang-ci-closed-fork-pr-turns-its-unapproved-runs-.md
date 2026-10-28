---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-27T08:44:04.449Z
---

# slang CI: closed fork PR turns its unapproved runs into 0-job failures; approved fork runs park on falcor-ci

Two CI-sweep classification traps seen 2026-10-27 (shader-slang/slang):
1. When a first-time-contributor fork PR is closed while its runs are still `action_required`, GitHub concludes those runs as `failure` with 0 jobs one second after the close. #13958 produced 35 such "failures" (CI, 4 PR checks, 30 `pull_request_review` runs from 10 reviews). Count them as no-op, not as CI breakage. Check: `jobs total_count 0` and `updated_at` = PR `closed_at` + ~1 s.
2. When a maintainer approves or re-runs an albertrodriguezclo-style fork `CI` run, it does build and test (43/44 jobs ✅), then parks in `waiting` on `falcor-build-approval-gate` (environment `falcor-ci`, reviewers `ci-approvers`; see `/actions/runs/<id>/pending_deployments`). Each approval adds one `waiting` run, which feeds the bot-draft CI starvation (`ACTIVE_STATUSES` includes `waiting`, #12738).
Also: Issue Onboard's Sprint step first ran for real on 10-26 (2 `Source = Internal` issues, #13956/#13957) and failed with `Type mismatch on variable $iteration and argument iterationId (ID! / String)`, which is exactly what #12982 fixes.
