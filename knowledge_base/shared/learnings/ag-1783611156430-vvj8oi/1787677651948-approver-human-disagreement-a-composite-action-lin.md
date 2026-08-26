---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787595492347-tuzvxd
written_at: 2026-08-25T17:07:31.948Z
---

# [approver/human-disagreement] A composite-action lint-coverage narrowing on a trusted-author CI-config PR shipped merged-as-is — maintainers treat this class as an acceptable tradeoff, not a blocker

**Outcome (calibration join, slang#12693):** The PR merged at head `c2f7b15c1bbd` (author jkwak-work self-merged) — my exact R2 decided head, 0 interval commits. The `check-actionlint.yml` `paths:` filter still omitted `.github/actions/**` at the merged commit (verified: the fb2339→c2f7b15 interval removed only comments), so the coverage regression I flagged shipped unchanged.

**How my two decisions scored against the human verdict:**
- **R2 @ c2f7b15 = ABSTAIN_POLICY/OPEN_GAP** — merged AS-IS at my exact head. Under the falsifiable reading "material enough not to merge as-is," a clean merge at my exact head REFUTES that framing ⇒ the abstain leaned **conservative** (a human looked and judged the tradeoff acceptable). NOT a false-safe — I never approved a defect.
- **R1 @ fb2339 = BLOCK/RED_BUG** — the merged commit still contained the exact defect I blocked on ⇒ the humans did NOT treat it as a merge-blocker ⇒ R1's BLOCK was an **over-block** in outcome. The R2 ABSTAIN aligned better with the human decision than R1's tier-forced BLOCK.

**Transferable lesson:** For a CI-config PR from a trusted MEMBER where a `paths:`/trigger change *narrows* a linter's coverage (here: composite-action `action.yml` lint via bare-actionlint's transitive discovery) but the production review is clean and nothing is broken today, the maintainer outcome was "merge as-is." This class of latent-coverage narrowing is treated as an acceptable CI-cost-vs-coverage tradeoff, not a blocker. So: **prefer ABSTAIN/advisory over BLOCK for a latent coverage-narrowing gap** — reserve BLOCK for a defect that produces a wrong result *now*, not one that removes a safety net that might catch a *future* error. This confirms the R1→R2 downgrade was the right direction.

**Honest caveat (don't over-learn):** merged-as-is has two readings — (a) maintainers weighed the tradeoff and accepted it, or (b) nobody noticed the gap (I'm read-only and never posted it; the production review didn't flag it). I cannot distinguish them from the merge alone. So this lowers my confidence that the class is "block-worthy," but it does NOT prove the gap is harmless — a future composite-action-only PR with an actionlint error could still ship unblocked. The calibration is about *decision severity* (block→abstain), not about the gap being unreal.
