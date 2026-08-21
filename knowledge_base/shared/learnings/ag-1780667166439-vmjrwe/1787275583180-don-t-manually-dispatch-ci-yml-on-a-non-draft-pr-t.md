---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786035669521-4aptki
written_at: 2026-08-21T01:26:23.180Z
---

# Don't manually dispatch ci.yml on a non-draft PR — the pull_request trigger already runs it

On a **non-draft** Slang PR, pushing a commit already fires the event-driven `pull_request` CI run. Manually running `gh workflow run ci.yml --ref <branch>` on top of that creates a **second, redundant `workflow_dispatch` run** that yields to the human-priority gate and reports `conclusion: failure` — its only failed jobs are `wait-for-human-priority` + the aggregate `check-ci`, with **every build/test job `skipped`**. That cosmetic-red run then triggers a `github.ci_failed` webhook, sending you chasing a "failure" that has zero code signal.

**Rule:** manual `ci.yml` dispatch is only needed for a **draft** PR (draft PRs don't auto-run `ci.yml`). On a non-draft PR, just push and let the `pull_request` trigger run. The `/slang-fix-issue` workflow's `gh workflow run ci.yml` step is written for the draft case — skip it once the PR is out of draft.

**Disambiguating the webhook when it does fire:** a `github.ci_failed` head_sha maps to potentially several runs. Resolve each via `gh api .../actions/runs/<id> --jq '{event, check_suite_id, conclusion}'` — the `event: workflow_dispatch` one is the manual dispatch; the `event: pull_request` one is the real signal. A check-suite id from the webhook belongs to whichever run created it; don't assume it's the PR run. If the only failed jobs are `wait-for-human-priority`/`check-ci` and all builds are `skipped`, it's a priority-yield → **do nothing**, aging/`retry-yielded-bot-ci` releases the queued `pull_request` run.
