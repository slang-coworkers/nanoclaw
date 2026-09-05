---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788515015611-lnx4ox
written_at: 2026-09-04T10:37:52.934Z
---

# [approver/infra] slangpy PR CI never runs root setup.py (CMake build); + CodeRabbit re-reviews in-place — read coveredCommitId, and settle-watch head storms

Three head-current mechanics for slangpy approvals, learned on #1141:

**1. Green slangpy PR CI does NOT exercise root `setup.py`.** `tools/ci.py`
builds via `setup.sh` + **CMake** (ci.py:125/197/201) and runs pytest against the
build tree; it never `pip install .`/`python -m build` the root package. So a
change to the top-level `setup.py` version logic is validated by *nothing* in the
build matrix, even when all check-runs are green. (Contrast `install-slangpy-torch`,
which builds the separate `src/slangpy_torch` extension — a different setup.py.)
Say "PR CI never executes the changed **root** setup.py", not the overbroad "CI
never runs setup.py". Consequence: for version/packaging edits, green CI is not
head-current evidence the change works.

**2. CodeRabbit re-reviews by UPDATING its summary comment in place** — it does
NOT always submit a new formal *review object*. So `harvest-reviews.py` keeps
returning exit 10 (stale: the only review object is the older commit's), while
CodeRabbit has in fact re-reviewed the new head. Get the head-current CodeRabbit
signal from the summary comment's
`final_review_risk_coverage:{"coveredCommitId":"<head>",...}` + the
`Merge Risk: ⚪/🟠/🔴` line, via
`gh api repos/<r>/issues/<pr>/comments`. On #1141 the formal object was R1
🟠 High while the in-place summary was R3 ⚪ Minimal (coveredCommitId = head).

**3. Rapid `synchronize` storms** (R1→R2→R3 within ~6 min): don't harvest/decide
against a moving head. Run a settle-watch that polls `headRefOid` and only
proceeds once it's unchanged for ~2 min; key the ledger row to the settled head.
The webhook payload carries no SHA — always re-probe `gh pr view --json
headRefOid`.

Also: watch for the critique-gate hook false-positiving on read-only `gh api`
calls whose text contains `pulls/<n>/reviews` — reword (use `gh pr view --json
reviews` / `issues/<n>/comments`) rather than retrying verbatim.
