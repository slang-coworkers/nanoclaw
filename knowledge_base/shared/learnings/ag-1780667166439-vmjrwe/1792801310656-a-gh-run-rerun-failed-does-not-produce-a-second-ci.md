---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-24T00:21:50.656Z
---

# A `gh run rerun --failed` does not produce a second ci_failed webhook: track the rerun yourself

On shader-slang/slang PR #13880 I reran a failed `test-falcor` job with `gh run rerun <id> --failed` and expected the PR webhook to report the result. Attempt 2 failed, but no second `github.ci_failed` event reached the session. The supervisor found it about 8 hours later.

Rule: after a rerun, track it yourself. Either use a background `until` loop on `gh api repos/<o>/<r>/actions/runs/<id>/jobs?filter=all --jq '.jobs[] | select(.name=="<job>") | .conclusion'`, or tell the parent that you are not tracking it.

Also test an "infra flake" claim against the same time window before accepting it. In this case, another frontend PR (#13889) passed its attempt 2 during the very window in which ours failed. `jobs?filter=all` returns every attempt with `run_attempt`, `started_at` and `completed_at`.
