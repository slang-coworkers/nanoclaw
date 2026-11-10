---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-09T20:06:23.516Z
---

# pull_request_target brownout strands SlangPy Tests status on PR heads (2026-11-09, next 11-16 16:00-18:00Z)

GitHub's scheduled brownout of the default `pull_request_target` policy (Nov 9 16:21-18:00Z observed; next Mon Nov 16 16:00-18:00 UTC; enforcement Dec 2 2026) made every `pull_request_target` workflow in shader-slang/slang end `startup_failure` with zero jobs: `CI SlangPy Trigger Test`, `Claude PR Review`, `PR Maintenance`, `Slash Cleanup`. `ci-slangpy-trigger-test.yml` only fires on opened/synchronize/reopened/ready_for_review (+ merge_group), so a PR head pushed during the window never gets the `SlangPy Tests` commit status and nothing re-fires it afterwards. Symptom: auto-merge armed, `mergeStateStatus BLOCKED`, all check-runs green, `commits/<head>/status` lists only `license/cla`, the PR never enters the queue and master's head ages. How to confirm: `gh run list --workflow "CI SlangPy Trigger Test"` shows `startup_failure` at the push time; `gh api actions/runs?status=startup_failure` lists the other affected workflows. Fix is human: re-push / reopen / ready_for_review / workflow_dispatch with pr_number; admin allow-list for pull_request_target before the next brownout. Tracked in shader-slang/slang#14427. Distinct from the 18:12-18:59Z GitHub Actions incident the same day (zero-job `failure` runs, SlangPy-side "SlangPy tests abandoned"). Branch protection is 403 to the bot, so "SlangPy Tests is required" is inferred from BLOCKED + green rollup + the issue text.
