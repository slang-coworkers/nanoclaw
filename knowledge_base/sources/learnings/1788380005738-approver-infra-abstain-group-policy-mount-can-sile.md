---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787938188929-grsurk
written_at: 2026-09-02T20:13:25.738Z
---

# [approver/infra-abstain] Group policy mount can silently vanish → eval-clauses falls back to bundled v0-shadow, spuriously failing author_trust

## Symptom

shader-slang/slang PR #12820, a later synchronize (head 0d33e4efb5cd). Same bot
author (nv-slang-bot, CONTRIBUTOR) that PASSED `author_trust` on two earlier
decisions days before now FAILS it, and `eval-clauses.py` reports
policy_version **v0-shadow** instead of the **v0-shadow-wide** the prior runs
used. Result: ABSTAIN_POLICY where nothing about the PR changed.

## Root cause

The group-mounted approval policy disappeared. `eval-clauses.py` resolves the
policy in this order:
1. `--policy PATH` (explicit)
2. per-PR `<ws>/policy/APPROVAL_POLICY.json`
3. group mount `/workspace/extra/approver-policy/APPROVAL_POLICY.json`
4. bundled default `<skill>/scripts/APPROVAL_POLICY.json` (policy_version
   `v0-shadow`)

Both `/workspace/extra/approver-policy/` and `/workspace/agent/policy/` were
EMPTY directories (the mount was lost between sessions — on the prior run codex
had attested both paths holding v0-shadow-wide, sha 72df712…). With the mount
gone it silently fell through to the **bundled v0-shadow**, whose
`trusted_associations` are only `['COLLABORATOR','MEMBER','OWNER']` — NOT
`CONTRIBUTOR`. So a bot/CONTRIBUTOR author that the group's real policy
(v0-shadow-wide) trusts now fails author_trust. The fallback is BY DESIGN when
no policy is mounted; the defect is the mount vanishing, which is silent.

## How to catch it

Whenever a clause result flips for an unchanged PR, or `eval-clauses.py` prints
a **different policy_version** than a recent decision on the same PR used,
suspect a lost policy mount before trusting the clause verdict. Concretely:
- `ls -la /workspace/extra/approver-policy/ /workspace/agent/policy/` — an EMPTY
  dir means the mount is gone and clauses ran under the bundled default.
- Compare the printed `policy_version` to prior decisions' rows for the same PR.

A silently-degraded policy corrupts EVERY subsequent decision (wrong trusted
set, wrong caps, wrong protected paths), so it must alert, not pass.

## Fix

- Record the abstain with an **infra** reason_code (CLAUSE_UNEVALUABLE:<clause>
  or similar) so it lands in the infra metric and alerts — do NOT record a bare
  CLAUSE_FAIL:author_trust, which would falsely assert "untrusted author" when
  the truth is "policy missing." Note the true root cause in the challenger
  field.
- Escalate to the operator to restore the mount
  (`/workspace/extra/approver-policy/APPROVAL_POLICY.json` = v0-shadow-wide).
- Do NOT "helpfully" fall back to the bundled default and decide as if it were
  authoritative — the clause outputs are not authoritative without the group's
  real policy.
