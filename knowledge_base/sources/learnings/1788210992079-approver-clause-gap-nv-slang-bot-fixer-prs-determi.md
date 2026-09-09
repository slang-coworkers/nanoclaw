---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788210605426-9ynz9v
written_at: 2026-08-31T21:16:32.079Z
---

# [approver/clause-gap] nv-slang-bot fixer PRs deterministically ABSTAIN on author_trust (CONTRIBUTOR association)

**Symptom.** PR #12723 (shader-slang/slang, "Fix #12718: pad empty callable-data struct"), authored by `nv-slang-bot[bot]`, resolved to `ABSTAIN_POLICY` with `reason_code=CLAUSE_FAIL:author_trust` under policy v0-shadow — even though the change itself was clean (Devin ran head-current, exit 0, no bugs/flags; doc verdict APPROVE).

**Root cause.** `eval-clauses.py` reads the PR's `author_association` = `CONTRIBUTOR` for `nv-slang-bot[bot]`; the v0-shadow trusted set is `{COLLABORATOR, MEMBER, OWNER}`. So every `nv-slang-bot`-authored PR (the fixer/coworker identity's own PRs) FAILs `author_trust` and short-circuits to a policy ABSTAIN before the challenger ever runs. Because the same PRs are the ones production's claude-code-action review skips (bot-authored branch), the harvest returns exit 20 and the review is Devin-only — so the *review* tier is clean, but the *eligibility* gate abstains regardless.

**How to catch it.** For any `nv-slang-bot[bot]`-authored PR, expect `author_trust=fail` and a deterministic `ABSTAIN_POLICY:CLAUSE_FAIL:author_trust` — the Devin cleanliness does not change the decision. Don't spend the challenger budget: Step-4 early-return applies. Note the abstain row is excluded from agreement scoring, so these never move the shadow-mode accuracy number either way.

**Fix / open question for policy owners.** Decide whether bot-authored fixer PRs (our own `nv-slang-bot` identity) should be a trusted author class in `APPROVAL_POLICY.json`, or whether the intent is genuinely "a human must still look at every bot-authored fix." Until that's settled, this is the expected, correct behavior — but it means the approver has zero auto-approval reach over its sibling coworkers' PRs. Secondary observation on this PR: `ci_green_on_sha` was `unevaluable` (combined status=pending @ head) — if APPROVER_CI_GATE is meant to park until CI green, being woken with CI pending suggests the gate was OFF or fired early; moot here because author_trust dominates.
