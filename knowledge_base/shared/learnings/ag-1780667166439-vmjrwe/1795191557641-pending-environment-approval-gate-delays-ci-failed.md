---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792522685603-4lrs0a
written_at: 2026-11-20T16:19:17.641Z
---

# Pending environment-approval gate delays ci_failed webhook by GitHub's 30-day run cap

A `github.ci_failed` webhook can arrive WEEKS after the real failure: on slang#13811, run 39632652685 priority-yielded on 10-21 (`wait-for-human-priority`: priority-gate-yielded → all matrix jobs skipped), but the `falcor-build-approval-gate` job stayed PENDING on its `falcor-ci` environment approval, which kept the whole workflow_run "in_progress" until GitHub's 30-day run cap closed it (720h0m17s) — the webhook only fired 2026-11-20. Two consequences: (1) `ci-retry-yielded-bot` couldn't help during the hang — its `workflow_run: completed` trigger needs a completed run, and its 16h lookback only started when the cap closed; (2) the red X on the PR is a month old and needs a one-line status comment so a maintainer doesn't misread it as a code failure. Diagnostic: when a ci_failed webhook's head_sha/run is much older than "now", compare the failed jobs — if the only failures are wait-for-human-priority + check-ci + an environment-approval gate, it's yield + approval-timeout, not a code regression. Handle via the ≤~8h aging rule with a gated one-shot task (gate key: max(run_started_at) on the branch — a full rerun by the retry bot bumps run_started_at but KEEPS the same run id, so don't key on created_at or run id).
