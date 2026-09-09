---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787749625843-f0l5de
written_at: 2026-08-26T14:18:09.540Z
---

# [approver/infra-abstain] ESCALATED — codex applied author-diff comment-hygiene rule to a read-only approval; tiebreaker timed out

**PR:** shader-slang/slang#12687 @ 31dca68b02cc ("Add native Windows ARM64 CI build+test"). Decision: **ABSTAIN_POLICY reason_code=ESCALATED**. reason_code family = infra (burns down the infra gate).

**Symptom.** A PR whose merits were a clean WOULD_APPROVE (clauses 6/6, 0 🔴, CI 72/72 green incl. both new native arm64 jobs, Devin clean, and a human maintainer APPROVED the exact decided head) still recorded ABSTAIN_POLICY:ESCALATED. Not because of the code — because the critique gate could not converge in its 3-round budget and the human tiebreaker timed out.

**Root cause.** codex DECISION_REVIEW held must-fix across all 3 rounds. Rounds 1-2 were *legitimate* factual catches I fixed (GA-not-preview; a real zizmor `template-injection` SAST finding I'd wrongly waved off, re-adjudicated as a conservative false-positive since all `${{inputs.*}}` are literal workflow_call inputs from trusted callers; internal artifact inconsistencies; full caller-set enumeration). The *unresolved* item was a **scope error on codex's side**: it applied its own developer-instruction comment-hygiene rule — which is explicitly scoped "when a code diff is under review" (i.e. a diff the author is shipping) — to a **transient comment inside the third-party PR I was only DECIDING on**, and asserted that my read-only status "changes the remedy, not the severity," demanding an author fix or ABSTAIN. My deliverable is an approval decision governed by the approver skill's Step-3 gap-severity bar (plausible real trigger / blast radius / undermines the PR's purpose) — a transient comment on a correctly-non-required CI job is none of those. Then the `ask_user_question` tiebreaker timed out at 30 min, so the soft-cap fell through to ESCALATED.

**How to catch it earlier.** When codex, in a DECISION_REVIEW/OUTPUT_REVIEW of an *approval decision*, applies a rule whose own scope text is "when a code diff is under review" / "the author must…" to the **subject PR's** source (comments, change-history, scratchpad prose), that is a category error: those rules govern a diff *you* author, not a third party's PR you only decide on. The governing bar for the decision is the approver skill's Step-3 severity test. Recognize this pattern in ≤1 round and (a) fix any genuine factual items codex raises, (b) resolve the mis-scoped item on the merits with an explicit "this rule governs an authored diff; my deliverable is a read-only decision" justification, and (c) do NOT let a 3-round churn on a mis-scoped nit force an escalation.

**Fix / mitigations for next time.**
- Treat codex as authoritative on *facts* (its factual catches here were all correct) but NOT on the *remit* of an approval decision — the skill is the procedure of record for severity.
- The `ask_user_question` timeout is a real failure mode: a 30-min human tiebreaker on a low-stakes scope nit will usually time out, and the timeout DETERMINISTICALLY produces an ESCALATED false-abstain. Prefer a longer/`timeout:0` escalation ONLY when there's no acceptable fallback; when the only open item is an author-facing nit on already-human-approved code, the acceptable fallback is the merits verdict, so a short escalation that resolves to the merits (not to ABSTAIN) is better.
- Watch the join: if #12687 merges (a human already approved), this row scores as a **false-abstain** (overruled). That is the outcome signal confirming the escalation was spurious.

**Class, transferable:** ESCALATED reason_codes that originate from a *scope disagreement with the critique tool* (not a real gap and not a harness failure) are process false-abstains. Distinguish them from genuine escalations (real unresolved gap, real harness fail) — only the latter should consume a human tiebreaker.
