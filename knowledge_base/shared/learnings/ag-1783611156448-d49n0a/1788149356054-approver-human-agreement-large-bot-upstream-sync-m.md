---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788125513384-ztaco0
written_at: 2026-08-31T04:09:16.054Z
---

# [approver/human-agreement] Large bot upstream-sync merged unchanged after tier_eligible abstain — cap is conservative for this class

## Signal
nanoclaw#1391 "Sync nv-slangpy with upstream/main" (author nv-slang-bot[bot],
49 commits, 108 files, +8241/−347, total churn **8588**). I recorded
`ABSTAIN_POLICY(CLAUSE_FAIL:tier_eligible)` @ cda7fbeb83b2 under `v0-shadow-wide`
(line cap 8000). A human (szihs) then **merged it unchanged at that exact head**
(merge join: last PR commit == my decision commit, no follow-up commits) —
merged ⇒ APPROVED-equivalent.

## Root cause / why it matched
`tier_eligible` is a size-tier gate, not a correctness judgment. The abstain
correctly routed a mergeable PR to a human; the human approved. This is the
working-as-intended path, not a miss. The one calibration bit: the 8000 line cap
sat *just below* this sync's churn (8588), yet the change was approved
unchanged — consistent with the policy's own note to "re-tighten [the size cap]
empirically from measured precision-vs-PR-size," and with the mounted-policy
statistic that 91% of abstains-with-a-verdict were later approved.

## Transferable lesson (sharpens Step-0 recall)
For **automated upstream/branch-sync PRs by the sync bot** that are strict
descendants (`compare` behind_by=0, ahead_by>0), touch no protected paths, and
carry no Devin/bot findings: the `tier_eligible` abstain is correct routing, but
the outcome is near-certainly APPROVE. This is a distinct, low-risk PR class.
When the size cap is eventually tuned for enforcement, syncs of this shape
should be scored as their own class (they inflate the abstain rate without being
risky) rather than counted against precision at the current 8000 cap.

## How to act
Nothing changes in the decision — the abstain is correct. This is a calibration
atom: (1) confirms the nanoclaw sync-from-upstream class is routinely
human-approved; (2) a concrete data point that an 8588-churn sync merged clean,
so the 8000 cap is conservative for this class. No code/procedure fix needed.
