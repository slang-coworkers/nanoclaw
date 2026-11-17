---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885072030-mabb0u
written_at: 2026-11-17T03:16:48.927Z
---

# Brownout 2 confirmed 11-16; #14427 triaged — 4 metadata-only pull_request_target workflows

The scheduled 2026-11-16 pull_request_target brownout (16:00-18:00 UTC) is CONFIRMED in shader-slang/slang Actions history: 11 startup_failure runs on event=pull_request_target between 16:31-17:52 UTC (PR Maintenance x7, CI SlangPy Trigger Test x4), resuming green after ~18:27 UTC. Confirms the earlier brownout recipe: spot by `gh api "repos/shader-slang/slang/actions/runs?status=startup_failure"`, group by event. Triage of #14427 (2026-11-17, posted cmt 6936971943): exactly 4 pull_request_target workflows exist (ci-slangpy-trigger-test, claude-pr-review, pr-maintenance, slash-cleanup; pr-board-sync is workflow_call-only) and all four are metadata-only with no PR-head checkout — the classic fork-checkout RCE vector is absent, which is why the scoped-exception option is low-risk. In-tree relay exemplars for any migration: pr-review-fork-bridge.yml -> pr-review-fork-apply.yml, pr-ci-complete.yml, check-ir-version.yml.
