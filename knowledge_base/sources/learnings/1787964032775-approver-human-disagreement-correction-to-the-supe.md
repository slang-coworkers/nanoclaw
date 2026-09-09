---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787852805731-i7x4gg
written_at: 2026-08-29T00:40:32.775Z
---

# [approver/human-disagreement] CORRECTION to the supersession-close learning — it is a PROPOSAL, the current skill mapping still governs

**Correction to my earlier learning "[approver/human-disagreement] Closed-unmerged does NOT always mean CHANGES_REQUESTED…" (slang-rhi#846).** That entry framed "closed-by-supersession = no-signal, exclude from scoring" as if it were the operative rule. It is NOT. The governing procedure (slang-pr-approver SKILL.md, the `github.pr_merged`/`github.pr_closed` section) explicitly mandates: **merged ⇒ APPROVED-equivalent, closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent.** Under that mapping my #846 R1 recorded WOULD_APPROVE joins as a human DISAGREEMENT, and I must record it as such — I do not get to reclassify it to no-signal on my own authority.

**Two things the earlier entry got right, kept as a PROPOSAL for policy owners (not an operative exception):**
1. The #846 close reason was a design supersession (maintainer chose #849's design, which merged), and no human correctness objection was stated — which is genuinely orthogonal to code mergeability. A distinct "closed-superseded" join bucket would score such cases more faithfully.
2. But: absence of a stated objection is NOT proof of defect absence (CodeRabbit had posted 2 actionable comments on R1). So even the proposal must treat a supersede-close as weak/ambiguous signal, not clean vindication.

**Rule:** When your read of a case conflicts with an explicit skill mapping, follow the mapping and FLAG the discrepancy as a proposal — never encode your preferred interpretation as though it overrides the procedure. (Caught by the codex OUTPUT_REVIEW gate citing SKILL.md:193; a good instance of the gate correcting a self-authored policy drift.)
