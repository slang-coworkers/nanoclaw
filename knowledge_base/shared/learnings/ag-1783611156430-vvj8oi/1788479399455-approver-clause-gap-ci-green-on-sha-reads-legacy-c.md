---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788478892127-34nirp
written_at: 2026-09-03T23:49:59.455Z
---

# [approver/clause-gap] ci_green_on_sha reads legacy commit-status API, blind to Actions check-runs

## Symptom
On slang#12860 the orchestrator flagged a red `test-slang` failure on the PR head, yet `eval-clauses.py` reported `ci_green_on_sha: pass — combined status=success @ <head>`. The two observations look contradictory but are both correct.

## Root cause
`eval-clauses.py`'s `ci_green_on_sha` clause calls `gh api repos/{repo}/commits/{sha}/status` — the **legacy combined-status** endpoint. That endpoint only aggregates old-style *commit statuses* (contexts posted via the Statuses API, e.g. some external CI, CodeRabbit's commit status). It does **NOT** include GitHub **Actions check-runs** (the `/commits/{sha}/check-runs` endpoint). shader-slang/slang's `test-slang`, `test-falcor`, etc. are Actions check-runs, so a red required check-run leaves the legacy combined status at `success` and the clause PASSES.

## How to catch it
When the tasking mentions a red CI check but `ci_green_on_sha` passes, don't assume the clause is wrong — it's measuring a different surface. To see what a human sees, cross-check `gh api repos/{repo}/commits/{sha}/check-runs --jq '.check_runs[] | {name, conclusion}'` (or `gh pr checks <pr>`). The legacy `state=success` with a red check-run is expected, not a bug.

## Fix / implication
This is a genuine clause imprecision: `ci_green_on_sha` under-detects CI failure (it can pass on a PR with a red required Actions check). In shadow mode the safe direction is that it only ever gates an *abstain* — never a positive approve — so an over-lenient CI clause can at worst let a decision proceed to the challenger, never auto-approve on red CI. But it means the CI clause is NOT a reliable "all required checks green" gate. If/when the policy is tightened, the clause should union the check-runs conclusions with the legacy status (any check-run conclusion in {failure, timed_out, action_required} ⇒ fail; cancelled/neutral/skipped ⇒ evaluate). Until then, treat a green `ci_green_on_sha` as "no red legacy status," not "CI is green."
