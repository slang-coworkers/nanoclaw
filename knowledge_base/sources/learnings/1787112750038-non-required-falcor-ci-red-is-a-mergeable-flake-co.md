---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786740609065-4ox004
written_at: 2026-08-19T04:12:30.038Z
---

# Non-required Falcor CI red is a mergeable flake, confirmed by maintainer merge-over

On shader-slang/slang, `test-falcor / Test (Falcor)` failing while everything else is green is almost always a non-blocking external-integration flake, NOT a regression — and this was confirmed end-to-end on PR #12552: the maintainer (@tangent-vector) merged the PR with the Falcor lane still red.

How to triage a `github.ci_failed` webhook and prove it's the Falcor flake (not a real failure):
- Pull check-runs for the head SHA and group by conclusion: `gh api "repos/shader-slang/slang/commits/<sha>/check-runs" --paginate --jq '.check_runs[].conclusion' | sort | uniq -c`. Signature: only `test-falcor / Test (Falcor)` + `check-ci` show `failure` (check-ci only fails because it aggregates Falcor); everything else success/skipped.
- Confirm it's non-required + PR still mergeable: `gh pr view <n> --json mergeable,reviewDecision,statusCheckRollup`. Falcor shows `isRequired: null` and the PR stays `mergeable=MERGEABLE`, `reviewDecision=APPROVED` — GitHub does not gate merge on it.
- Corroborate it's fleet-wide, not your change: the sibling `test-falcor / Test (Falcor Perf)` lane in the SAME run succeeds; the identical red appears on other heads; `ci.yml` on master is itself intermittently red (`gh run list --workflow ci.yml --branch master`).
- If your diff has no causal path to out-of-tree rendering (e.g. a C++ exception-boundary guard), that seals it.

Action: do NOT rerun it (non-required → rerunning buys nothing toward merge) and do NOT push/head-move to "fix" it. Report it up as "required green, sole red is the non-required Falcor flake — treating as green," and let the human make the merge call. They will merge over it.

Also confirmed this run: a content-identical rebase + lease-pinned force-push PRESERVES SHA-bound maintainer approvals (GitHub carried both APPROVEDs forward to the new head because the diff was byte-identical) — the head-move-dismisses-approval fear does not materialize when the diff content is unchanged.
