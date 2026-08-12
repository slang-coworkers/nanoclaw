---
title: "[approver/critique-mustfix] Per-revision [Approval Decision] delivery is mandatory (dashboard) — distinct from the materiality-gated upstream [Report]"
type: learning
topic: review-approval
source: learnings/1783958368120-approver-critique-mustfix-per-revision-approval-de.md
---

# [approver/critique-mustfix] Per-revision [Approval Decision] delivery is mandatory (dashboard) — distinct from the materiality-gated upstream [Report]

**Symptom:** On a slangpy#1063 revision whose decision class was unchanged (still
ABSTAIN_POLICY), an orchestrator instruction said "only re-report upstream if the
decision materially changes." I read that as "suppress the [Approval Decision] entirely
this revision" and planned to send only a plain status. DECISION_REVIEW (codex) flagged
this must-fix: it conflates two distinct channels.

**Root cause:** There are TWO separate delivery obligations, to two destinations:
1. **Per-revision DECISION DELIVERY** — the `[Approval Decision]`-marked message to the
   DASHBOARD. SKILL.md Step 4 requires this for EVERY recorded ledger row ("an unmarked
   decision routes nowhere"; the gate + router key on the marker). It is NOT gated on
   materiality — every revision that records a row also delivers its [Approval Decision].
2. **HEAVY UPSTREAM [Report]** — the 5-bullet escalation to the parent/orchestrator.
   THIS is what an orchestrator "only re-report if materially changed" instruction
   governs. A no-class-change revision skips the heavy upstream report and sends the
   parent only a brief status.

"No decision-class change" ≠ "no decision delivery." Suppressing the [Approval Decision]
because the class didn't change starves the dashboard/ledger observability that exists
precisely to show every per-revision row.

**How to catch it:** When an instruction gates "re-reporting," ask WHICH channel it
means. Materiality gates the upstream escalation; it never suppresses the mandatory
per-revision dashboard decision delivery. If you're about to record a ledger row, you
are also about to emit its [Approval Decision] — full stop.

**Fix:** For every recorded revision: (a) record_decision, (b) emit [Approval Decision]
to the dashboard (state "class unchanged" when it is), (c) send the parent a brief
status OR — only when the decision class materially changed — the heavy 5-bullet
[Report]. Related: a size-cap CLAUSE_FAIL is terminal at Step 1, so PR-state changes
like dropping a [DO NOT MERGE] marker or a new (even DISMISSED) human review (→
mode=live_late) are notable status items but do NOT change the decision class while the
diff stays over cap. See [[approver-clause-gap-terminal-step1-fail-dominates]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783958368120-approver-critique-mustfix-per-revision-approval-de.md`_
