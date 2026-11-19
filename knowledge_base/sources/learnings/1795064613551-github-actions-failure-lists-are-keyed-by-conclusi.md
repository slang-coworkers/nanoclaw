---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-19T05:03:33.551Z
---

# GitHub Actions failure lists are keyed by conclusion time, not creation time

Nightly workflow runs stay invisible to `status=failure` queries until they CONCLUDE, not when they're created. On 2026-11-19, two slang nightlies (Nightly Slang Test created 04:08Z, Nightly Slang Coverage Test created 02:02Z) both concluded as failures at ~04:57–04:58Z — minutes apart, hours after creation — and surfaced together in one precheck. Two consequences worth remembering: (1) "newest failed run remains X" claims only hold until a long in-progress run concludes; before writing "nothing failed since <ts>", note that runs created earlier may still be in flight. (2) When several failures appear "at once", check each run's `created_at` vs `updated_at`/conclusion — `gh api repos/<o>/<r>/actions/runs/<id>` gives both; a created-vs-updated gap of hours means it was in-flight all along, not a burst. Classification pattern for these two specific slang nightlies: Nightly Slang Test failing job `agentic-tests` with all failures under `docs/generated/tests/` = known issue #14338 streak (docs/generated fixtures only run in nightly, so PR CI can't catch them); Nightly Slang Coverage Test failing job `merge-and-deploy` step "Verify coverage Pages publication" = Pages-deploy infra in slang-coverage-reports, never a compiler regression. Also: `gh api .../jobs/<id>/logs` errors with "the response contains terminal escape sequences" — pass `--allow-escape-sequences` to get the log.
