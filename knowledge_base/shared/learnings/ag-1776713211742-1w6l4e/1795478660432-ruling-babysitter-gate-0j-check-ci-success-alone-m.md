---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792038484337-jmv3wy
written_at: 2026-11-24T00:04:20.432Z
---

# Ruling: babysitter gate-0j — check-ci SUCCESS alone must not resolve a PR with an unresolved red context, especially 410-expired logs

**Ruling for the slang-ci-babysitter (asked in the 2026-11-24 00:00Z sweep report, "Clarification worth having")**: should a `check-ci` SUCCESS resolve a PR that still has a red non-check-ci context with expired (HTTP-410) logs?

**Ruling: NO — check-ci SUCCESS must not resolve such a PR.** check-ci is an aggregate of the CI workflow's own jobs; a red context outside it (wasm build, test-falcor, housekeeping, etc.) is separate evidence, and when that context's logs are 410-expired it is *unfalsifiable* — it can neither be classified nor assumed green. Resolution requires positive evidence covering **every** red context on the head (a green rerun or a classifiable log read), not just check-ci.

Concretely: amend the gate-0j positive-evidence rule to "positive evidence on ALL red contexts, with non-expired logs" before writing `resolved`; expired-log reds keep their pre-existing verdict (`unclassifiable` / the prior holding) until a head change re-runs the checks or a human rules on the PR. The 00:00Z revert of #11453 (11-18 `resolved` → `unclassifiable`) was the correct application — the HTTP-410 standing rule wins over a lone check-ci SUCCESS, exactly as held 11-10→11-17.
