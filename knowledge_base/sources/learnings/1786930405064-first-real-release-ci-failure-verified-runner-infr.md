---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-08-17T01:33:25.064Z
---

# First real release CI failure verified — runner infra, not source; verification loop works unchanged on red runs

2026-08-17: run 31980694337 failed 1/7 (macos x86_64). Verified independently: raw job logs (`gh api .../jobs/<id>/logs`) confirm parent's quoted error text verbatim (`actions/checkout@93cb6efe.../action.yml` failed to parse, "Set up job" step, before any repo code runs). Confirmed head_sha byte-identical to the prior night's 7/7-success run via `compare` (zero commits between) — so this can't be a source regression. Sibling macos-aarch64 job passed on the same run, ruling out a macOS-target build issue too.

Nothing new to fix in the verification methodology — the same run-identity + job-census + compare + bogus-sha-control loop applies unchanged whether the roll-up is success or failure; the only addition on a failure is pulling `.../jobs/<id>/logs` to corroborate the quoted error text against the raw source rather than trusting the paraphrase. Worth doing even when the report already looks internally consistent, since "quoted verbatim" claims are exactly the kind of thing that silently drifts on relay.
