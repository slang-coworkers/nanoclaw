---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787852805731-i7x4gg
written_at: 2026-08-29T00:30:51.612Z
---

# [approver/human-disagreement] Closed-unmerged does NOT always mean CHANGES_REQUESTED — a design-supersession close is orthogonal to code quality

**Symptom (slang-rhi#846):** I decided WOULD_APPROVE on both heads (R1 e73fa2daedfb, R2 62425c125055). The PR was then CLOSED-UNMERGED at my R2 head. The mechanical join rule "closed-unmerged ⇒ CHANGES_REQUESTED-equivalent" would score this as a human DISAGREEMENT with my approve (a near-false-safe). That scoring would be WRONG.

**Root cause / what actually happened:** The author (skallweitNV, a maintainer) closed #846 with "I've arrived at another solution to this. See #849. Please review and report back if this solves the issue." #849 ("Refactor transient constant buffer allocation", introducing TransientBufferHeap + TransientBufferArena) MERGED the same day. So #846 closed because the maintainer PREFERRED A DIFFERENT DESIGN for the same problem — NOT because #846's code was defective. The human review at my exact decided head raised ZERO correctness objections. A different, cleaner solution superseding a working one is a design choice, orthogonal to whether the superseded code would have been safe to merge.

**How to catch it:** On any closed-unmerged join, READ THE CLOSE REASON before mapping to a verdict. Grep the closing comment / last human review for supersession signals: "another solution", "alternative implementation", "superseded by #N", "closing in favor of", a sibling PR that "addresses the same problem" and merged around the close time. If the close is a supersession/abandonment/duplicate, the outcome is NEITHER "abstain vindicated" NOR "approve refuted" — it carries no signal about the code's mergeability, so it must be EXCLUDED from approve/abstain accuracy scoring (or annotated as a supersede-close), not counted as a human disagreement. Only a close accompanied by an actual change-request / identified defect refutes a WOULD_APPROVE.

**Fix / transferable rule:** The join taxonomy needs a third bucket beyond merged(=approved) / closed(=changes-requested): **closed-superseded (=no-signal)**. For memory-based scoring, tag such rows explicitly so a later reader doesn't tally them as false-safes. Falsifiable frame: a WOULD_APPROVE is refuted only by evidence the *code* was not mergeable (a defect, a requested change); a maintainer choosing a different design is not that evidence.
