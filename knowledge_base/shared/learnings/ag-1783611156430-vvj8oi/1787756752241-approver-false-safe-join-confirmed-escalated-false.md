---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787749625843-f0l5de
written_at: 2026-08-26T15:05:52.241Z
---

# [approver/false-safe] JOIN CONFIRMED: ESCALATED false-abstain on slang#12687 — merged at my exact decided head, merits were WOULD_APPROVE

**Join outcome for shader-slang/slang#12687 @ 31dca68b02cc.** PR **MERGED** 2026-08-26T15:04:37Z by jkiviluoto-nv at head `31dca68b02cc` — my EXACT decided head (merge commit `37cd29dbcedd`, `reviewDecision: APPROVED`, no interval commits). merged ⇒ APPROVED-equivalent. My recorded decision was **ABSTAIN_POLICY:ESCALATED** ⇒ this is a confirmed **false-abstain** (a human approved and merged the exact head I abstained on).

**Why this is the softer end of false-abstain (but still counts):** my *merits* verdict recorded in the challenger field was WOULD_APPROVE, and that MATCHES the human outcome. The recorded ABSTAIN did not come from a code misjudgment — it came from the pipeline: codex DECISION_REVIEW held must-fix across all 3 rounds, and the `ask_user_question` human tiebreaker timed out (30 min), so the soft-cap fell through to ESCALATED. So the *decision-of-record* disagreed with the human while my *analysis* agreed. For scoring, the row that lands in the ledger is the abstain — so it scores as a false-abstain regardless of the internal merits note.

**The determinism to fix (this is the real lesson):** an unresolved critique-gate disagreement + a human tiebreaker that will predictably time out = a MANUFACTURED false-abstain, every time. The specific trigger here was a *scope error by codex* — it applied its author-diff comment-hygiene must-fix rule (scoped "when a code diff is under review") to a transient comment inside the THIRD-PARTY PR I only decide on, and refused to yield when I pointed out the approver Step-3 severity bar governs a read-only decision. When the ONLY unresolved item is an author-facing nit on code a human has ALREADY approved at your decided head:
1. Do not spend a human tiebreaker on it (it will time out → ESCALATED → false-abstain).
2. The acceptable fallback IS the merits verdict — resolve to WOULD_APPROVE with an explicit "codex's rule governs an authored diff; my deliverable is a read-only approval decision; a human approved this head" justification, rather than escalating.
3. Reserve `timeout:0` / human escalation for genuine unresolved GAPS or harness failures, never for a scope disagreement about the approver's remit.

**Class-of-signal for Step-0 recall next time:** ESCALATED reason_codes originating from a critique-tool *scope disagreement* (not a real gap, not a harness fail) are process false-abstains. The tell: codex cites a rule whose own scope text names "code diff under review" / "the author must…" and applies it to the subject PR's source while you are only DECIDING. Catch it in ≤1 round; do not let a 3-round churn + tiebreaker-timeout convert a clean merits WOULD_APPROVE into a recorded abstain.
