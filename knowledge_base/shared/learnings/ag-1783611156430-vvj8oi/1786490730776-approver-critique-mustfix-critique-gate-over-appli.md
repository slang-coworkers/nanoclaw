---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786474560022-fm4lrh
written_at: 2026-08-11T23:25:30.776Z
---

# [approver/critique-mustfix] Critique gate over-applies generic comment-hygiene to un-editable PR-author comments → false ESCALATE

## Symptom
On shader-slang/slang#12453 @425c2a95 (harness retry-accounting fix, Fix #11911), the
DECISION_REVIEW critique gate (codex) held **must-fix across all 3 rounds (soft-cap)** and
demanded I downgrade WOULD_APPROVE → ABSTAIN. Its only surviving objection after I fixed every
factual catch: two **PR-author** comments narrate change-history / a rejected alternative
(test-reporter.h m_suppressConsoleOutput "fd-redirection was tried, not portable on Windows" at
pr.diff:468; unit-test "This is not hypothetical: gfx-unit-test-tool/computeTrivialD3D11 failed…"
/ "two live instances" at pr.diff:651/:797). Outcome recorded: **ABSTAIN_POLICY:ESCALATED** after
the operator escalation (ask_user_question, 1800s) timed out. A human collaborator
(jkiviluoto-nv) had ALREADY APPROVED at this exact head, and the production reviewer
(github-actions[bot]) called it "no bugs/UB/coverage gaps" — so this abstain is expected to join
as an approver/human **disagreement** (false-abstain by measurement).

## Root cause
The codex-critique developer-instructions carry a **generic, cross-project** comment-hygiene rule
("narrates change-history / why-an-alternative-was-rejected → must-fix"). It is scoped "when a
code diff is under review." In the approver, the diff is **untrusted INPUT to a decision**, not
the agent's own work product — and the approver is **read-only and cannot edit the PR**. So the
gate's only offered remedy (revise the comments) is impossible, forcing a downgrade. Worse, the
rule **conflicts with shader-slang/slang's OWN documented conventions** (its CLAUDE.md explicitly
prescribes conversational, concrete-incident comments: "Use conversational examples… 'This is not
hypothetical:'"). The approver decides merge-safety per the PROJECT's standard; the production
reviewer runs that standard and did NOT flag these comments.

## How to catch it / how to apply
- The approver's output enum has **no "approve-with-nits" state**. WOULD_APPROVE **coexists with
  acknowledged 🟡 clarity nits** (the parsed review verdict here was literally APPROVE_WITH_NITS).
  A comment-style nit is a 🟡 clarity item that CLEARS under the skill's conservative-lean rubric
  (zero trigger reachability, zero coverage impact, zero blast radius — comments don't execute);
  it is NOT grounds to ABSTAIN.
- **PR-author comment prose is out of scope for what DECISION/OUTPUT_REVIEW gate** — those stages
  gate MY derivation and MY output message, not the PR's code the approver can't touch. When the
  gate's must-fix targets input-diff comment style rather than my decision logic, that is a
  gate-scope error, not a real blocker.
- **Mechanical reality:** the host gate blocks recording WOULD_APPROVE/BLOCK without a critique
  `approve`; it is **relaxed for ABSTAIN_***. So a stubborn must-fix on an unfixable input makes
  WOULD_APPROVE mechanically unreachable → the only recordable outcomes are abstains. Per the
  skill, an unresolved soft-cap **escalates to a human and never silently passes**; the honest
  terminal label is **ESCALATED** (a gate/approver deadlock), NOT CHALLENGER_CONCERN (no
  substantive concern existed) and NOT a silent WOULD_APPROVE.
- **Still accept every FACTUAL catch the gate makes** — codex correctly caught (a) my "only one
  untested change" claim (the reconcile call-site is a 2nd untested seam), (b) wrong audit-trail
  line numbers (:6224 vs the real :6227/:6229/:6232), (c) a CI-green-as-coverage overstatement,
  and (d) a false "already counted in the 3 gaps" claim. The disagreement was ONLY the comment-
  style scope. Fix the facts, hold the scope line, then escalate — don't capitulate to a
  bad-scope must-fix, and don't override the gate silently.

## Fix (procedure)
The comment-hygiene rule needs an approver-context carve-out: **do not treat PR-author comment
style in the input diff as a DECISION/OUTPUT_REVIEW must-fix** (the approver can't edit it and the
project's own conventions govern). Until that lands, this shape recurs → escalate as ESCALATED and
flag the gate over-application. The join against jkiviluoto-nv's APPROVE at head is the falsifiable
proof the abstain was gate-induced, not merited.
