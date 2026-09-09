---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787044079919-89sted
written_at: 2026-09-01T22:51:40.252Z
---

# [approver/clause-gap] ci_green_on_sha reads the COMBINED STATUS API, not check-runs — a red commit status (e.g. cross-repo SlangPy Tests) fails it while every check-run is green; and the mounted policy can change between revisions of the same PR

**Context:** slang#12595 was WOULD_APPROVE at R1 (966939e9) and R2 (e480d28), then ABSTAIN_POLICY at R3 (30aa9e9f494a). Two independent gotchas drove the flip; both are transferable.

**Gotcha 1 — `ci_green_on_sha` uses the combined COMMIT STATUS, not check-runs.** In R1/R2 I verified CI via `gh api /commits/<sha>/check-runs?per_page=100` and saw 0 failures. That is NOT the whole CI picture. `eval-clauses.py`'s `ci_green_on_sha` clause reads the **combined commit status** (`gh api /commits/<sha>/status` → `.state`), which aggregates *commit statuses* (a separate GitHub surface from check-runs): CLA bots, CodeRabbit's status, and **cross-repo statuses** like "SlangPy Tests" (a slangpy CI run posted back onto the slang commit). At R3 every one of the 69 slang check-runs was green, but the combined status was `failure` because the "SlangPy Tests" commit status was RED.
- LESSON: to judge whether a slang commit is "green," check BOTH `/commits/<sha>/check-runs` AND `/commits/<sha>/status`. A green check-run set does not imply a green combined status. Report the specific failing status context + its target_url so the human can triage.
- For a slang TEST-ONLY PR (no source/compiler change), a failing SlangPy status is almost certainly unrelated/infra (a test-only diff cannot change slangpy runtime), but `require_ci_green` still fails the clause — the approver does NOT get to hand-wave a red status and approve. ABSTAIN_POLICY (a human confirms) is the correct, conservative outcome; naming the unrelatedness helps the human triage fast.

**Gotcha 2 — the mounted APPROVAL_POLICY can change between revisions.** R1/R2 ran under `v0-shadow-wide` (`allow_fork_head` effectively true, CI-green not required) → both approvable. R3's `eval-clauses.py` header reported `v0-shadow` (the stricter bundled default: `allow_fork_head:false`, `require_ci_green:true`), which failed `head_provenance` (the PR is from a fork) AND `ci_green_on_sha`. Same PR, same fork, different outcome — driven entirely by the policy version, not a code regression.
- LESSON: never assume the policy is stable across a PR's revision chain. Read the `policy_version` that `eval-clauses.py` prints each time; if it changed vs a prior revision, say so in the report (the mount may have been intentionally tightened, or the wider mount may have dropped and fallen back to the conservative bundled default — flag it either way). A stricter policy producing an abstain is the system working as intended; a fallback-induced abstain is still the SAFE direction (never rounds up), so abstain regardless and let the human/operator reconcile the policy.

**Procedure note:** run `eval-clauses.py` AFTER synthesizing `review/review-doc.md`, not before — otherwise `commit_match` evaluates `unevaluable` (doc absent) and you'd record a spurious `CLAUSE_UNEVALUABLE` (an INFRA reason_code that dings the infra gate) on top of the real policy fails. Synthesize first, then clauses, so the abstain is cleanly a POLICY abstain.

Decision: ABSTAIN_POLICY, reason_code CLAUSE_FAIL:head_provenance (also CLAUSE_FAIL:ci_green_on_sha). Row: memory/imported/pr-12595-decided.md.
