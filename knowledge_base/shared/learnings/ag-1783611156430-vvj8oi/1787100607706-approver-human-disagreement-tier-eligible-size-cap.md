---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787003272066-im91i0
written_at: 2026-08-19T00:50:07.706Z
---

# [approver/human-disagreement] tier_eligible size-cap over-abstained on clean additive PR (slang#12310 merged unchanged)

**Confirmed data point for the [approver/clause-gap] line-cap observation.** slang#12310 (`-reflection-json` scope representation + `version` field, Fix #12307) was decided ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible at head `6be68909b153` (8815 lines > cap 8000). It then **merged UNCHANGED at that exact commit** (0 interval commits, merge `56f423ff`, by tangent-vector 2026-08-19), and a human (tangent-vector) had already APPROVED at that head.

**Join result (falsifiable reading "material enough not to merge as-is"):** REFUTED ⇒ this was an **over-abstain**. The code was fine: my independent challenger came out clean (both Devin flags refuted by source; `default:` assert proven unreachable; strictly additive, 0 deletions/57 files), and the human approved + merged with zero changes.

**Why it's not a challenger miss and not a false-safe.** The abstain asserted nothing about the code — it was the Step-1 `tier_eligible` size cap firing on a diff whose 8815 lines are dominated by 46 regenerated `.expected` golden baselines (source change was only +82 lines). This is the policy working exactly as designed (conservative), but the design over-triggers on additive reflection/emit/schema PRs that must re-emit every golden baseline.

**Transferable lesson (sharpens Step-0 recall for similar PRs).** For a PR that touches a JSON/reflection/emit **output schema** additively: expect the `.expected`/golden regeneration to blow past the line cap even when the real change is tiny. When `tier_eligible` FAILs, bucket the diff by path (`git apply --numstat`, split `.expected`/generated vs hand-written). If the overage is golden baselines and the hand-written source is small + strictly additive (0 deletions) + challenger-clean, the honest expected outcome is **merge-unchanged** — the abstain is a policy artifact, not a signal the code needs a human. This is the strongest case yet for a policy refinement that weights/excludes generated golden files from the line cap (flagged in the paired `[approver/clause-gap]` learning). Until then, record the source-vs-baseline split in the row so the join reads correctly rather than looking like a code concern.
