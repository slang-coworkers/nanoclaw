---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786474560022-fm4lrh
written_at: 2026-08-12T12:18:15.703Z
---

# [approver/human-disagreement] ESCALATED join CONFIRMED false-abstain: slang#12453 merged byte-identical at decided head, disputed comments unrevised

## Symptom
shader-slang/slang#12453 @425c2a9510df: I recorded **ABSTAIN_POLICY:ESCALATED** (my substantive
read was WOULD_APPROVE; the DECISION_REVIEW critique gate held must-fix 3 rounds/soft-cap on
PR-author comment style the read-only approver can't edit; operator escalation timed out). The
`github.pr_merged` join then landed: **MERGED at the EXACT decided head** (head_matches_decision,
lastCommit==decided head, merged_by jvepsalainen-nv). merged ⇒ APPROVED-equivalent ⇒ my abstain
is overruled: an approver/human disagreement.

## Root cause / what the join proves
The PR squashed and merged **byte-identical at my decided commit — zero interval commits.** So the
two comments codex demanded be revised (test-reporter.h:468 "fd-redirection was tried, not portable
on Windows"; unit-test:651/797 "This is not hypothetical: …/two live instances") were **NOT revised
and merged anyway.** That is the empirical refutation of codex's "these block merge" must-fix: a
generic comment-hygiene rule, applied to an un-editable input PR whose style matches slang's OWN
documented conventions, produced a **gate-induced false-abstain**. This CONFIRMS the earlier
`[approver/critique-mustfix]` learning filed on this same PR (gate over-applies comment-hygiene to
un-editable PR-author comments) — now with a merged-unchanged join as proof, not prediction.

## How to catch it / how to apply (transferable — the class, not this PR)
- **An `ABSTAIN_POLICY:ESCALATED` whose ONLY blocker was a critique-gate must-fix on PR-author
  COMMENT STYLE is a false-abstain candidate the moment a human can see the same comments.** When
  the human signal already exists at head (here jkiviluoto-nv APPROVED at the exact head *before* I
  recorded), the abstain is refuted on arrival — a clean approve/merge at my head REFUTES "material
  enough not to merge as-is." Don't let the gate manufacture an abstain the human channel already
  overruled.
- **Merged byte-identical at the decided head = the disputed change was NOT required.** On any
  ESCALATED/CHALLENGER_CONCERN join, diff the interval first (squash-only ⇒ compare head.sha, not
  ancestry): zero interval commits + merged ⇒ whatever the gate/challenger flagged was not a merge
  blocker. This is the cheapest possible falsification of a comment-style or clarity-nit must-fix.
- **The scope line to hold in future runs:** DECISION/OUTPUT_REVIEW gate MY derivation and MY output
  message, NOT the input PR's comment prose (which the approver cannot edit and the project's own
  conventions govern). A gate must-fix targeting input-diff comment style is a gate-scope error —
  accept the gate's FACTUAL catches, hold the comment-style scope, escalate as ESCALATED, and mine
  the join. The fix is a gate carve-out for approver-context comment hygiene; until it lands, this
  shape recurs and each ESCALATED join is expected to score as a disagreement.
- **Substantive-verdict/recorded-label split is itself a signal:** when the substantive read
  (WOULD_APPROVE) matches the human (merged) but the RECORDED label (ESCALATED) disagrees, the
  disagreement is with the tooling, not the code. Track those separately from genuine
  read-vs-human misses ([approver/false-safe]) — they burn down by fixing the gate, not the review.
See [[pr-12453-awaiting-join]], [[approver-root-mechanism-and-diligence-slots]].
