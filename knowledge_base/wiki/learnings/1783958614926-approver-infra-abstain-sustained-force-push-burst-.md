---
title: "[approver/infra-abstain] Sustained force-push burst starves head-current decisions → ABSTAIN_INFRA"
type: learning
topic: review-approval
source: learnings/1783958614926-approver-infra-abstain-sustained-force-push-burst-.md
---

# [approver/infra-abstain] Sustained force-push burst starves head-current decisions → ABSTAIN_INFRA

**Symptom:** On shader-slang/slang#12080, the author force-pushed 6 distinct heads in ~1h25m (7ba43048 → 59d7eb0 → d3c067d1 → 6dbacfaad7 → 7b2dbbc12e → f15a92a8449d), each an amended single commit responding to review feedback. Every attempt to record a head-current decision was superseded before it completed: a WOULD_APPROVE at 59d7eb0 passed DECISION_REVIEW but the head moved during OUTPUT_REVIEW; a WOULD_APPROVE at 7b2dbbc12e was confirmed correct by codex but the head moved before `record_decision`. Net: ~90 min, zero recorded decisions, until a hard bound forced ABSTAIN_INFRA.

**Root cause:** The approve pipeline is long relative to a fast author-iteration loop. A single head-current cycle = debounce settle (8 min) + production `claude-pr-review` (~6–36 min, occasionally slow) + Devin (~10–30 min) + a multi-round critique gate. If the author pushes every 1–10 min, no head survives a full cycle. Chasing each head burns a full cycle per push and never converges.

**How to catch it / what to do:**
- Detect the burst early (≥3 heads in a short window). Switch from the default debounce to a LONGER quiet window (8+ consecutive unchanged polls at 60s) BEFORE spending a review cycle. Don't re-harvest/re-Devin per push.
- Get an explicit HARD BOUND from the orchestrator/operator: e.g. "if still moving past T_deadline OR N distinct heads, record ABSTAIN_INFRA." Bake it into the settle watch so it self-terminates.
- The correct terminal state is **ABSTAIN_INFRA** with a reason like `PR_UNSTABLE_NO_HEAD_HELD` — a PIPELINE stall, NOT ABSTAIN_POLICY (no clause fail / no open gap survived challenger) and NOT a forced stale approve. It's excluded from agreement scoring.
- Record it at the current head, note that the change itself was approvable on the settled revisions you did analyze (so a human knows it's an instability abstain, not a merit problem), and recommend re-run on stabilization.

**Fix:** Keep superseded workspaces (SUPERSEDED.txt + decision.SUPERSEDED.json) so the audit trail shows the analyses were done, not skipped. One decision per settled revision remains the rule — an unstable PR simply may not yield a recordable one before the bound.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783958614926-approver-infra-abstain-sustained-force-push-burst-.md`_
