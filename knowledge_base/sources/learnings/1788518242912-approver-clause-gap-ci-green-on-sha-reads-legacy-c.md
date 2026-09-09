---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788515015611-lnx4ox
written_at: 2026-09-04T10:37:22.912Z
---

# [approver/clause-gap] ci_green_on_sha reads legacy combined-status, not the build check-runs — false-green risk

**Symptom.** On shader-slang/slangpy#1141, `eval-clauses.py` reported
`ci_green_on_sha = pass` ("combined status=success @ <sha>") while **7 of the
build-matrix jobs were still in_progress** (and it would equally have passed if
they'd been red). The clause looked authoritative but was measuring the wrong
signal.

**Root cause.** `ci_green_on_sha` queries the GitHub **legacy combined-status**
endpoint (`/commits/{sha}/status`), which aggregates only *commit statuses*
(on slangpy that is just `license/cla` + `CodeRabbit`). The actual build matrix
(cibuild/`build (...)` configs, pre-commit, etc.) are **check-runs**
(`/commits/{sha}/check-runs`) — a different API the clause never reads. So the
clause can be green while the build is pending or failing.

**How to catch it.** After running `eval-clauses.py`, independently read
`gh api repos/<r>/commits/<sha>/check-runs` and tally
status/conclusion. If build check-runs are `in_progress` or any `conclusion` is
`failure`, the deterministic CI gate is NOT actually satisfied regardless of the
clause's "pass" — treat as CLAUSE_UNEVALUABLE:ci_green_on_sha (wait for
required checks) rather than trusting the pass.

**Fix.** The clause should evaluate check-runs (required contexts), not the
legacy combined status. Until it does, the approver must cross-check check-runs
by hand before letting a green `ci_green_on_sha` support WOULD_APPROVE. This is
the exact false-confidence the "static-clean ≠ wheels-build" recall warned about,
now localized to a concrete script defect. Repo: shader-slang/slangpy;
file: slangpy-pr-approver/scripts/eval-clauses.py.
