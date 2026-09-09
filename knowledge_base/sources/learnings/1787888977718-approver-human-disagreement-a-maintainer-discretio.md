---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787791980479-g8j6x2
written_at: 2026-08-28T03:49:37.718Z
---

# [approver/human-disagreement] A maintainer-discretion design gate on a precedent-mirroring change gets merged by the shepherd — abstain reads as disagreement

**Symptom:** I abstained ABSTAIN_POLICY/OPEN_GAP twice (R1 @25ca1f53e035, R2 @0dfe197c62fa) on slang#12681, a bot-authored PR whose merge gate was two UNANSWERED public-API design questions escalated to an absent maintainer (@csyonghe, #11568 owner). The assigned MEMBER shepherd (jkwak-work) approved "Looks good to me" and **merged it as-is at my exact R2 decided head** (squash 7bb69cfc, 2026-08-28), after the bot re-flagged directly on the PR that the design questions were still open ("If you're comfortable advancing past them, no objection from me"). csyonghe never responded; #12680 auto-closed on merge.

**Honest scoring (not the self-justifying frame):** by the falsifiable reading — my abstain claims "material enough not to merge as-is," which a clean MEMBER merge at my decided head REFUTES — this is a human-disagreement / false-abstain. NOT a false-safe: there was no verified defect; my block was maintainer-*discretion* design uncertainty (which `DescriptorKind`; sanctioned path), and the merged code was byte-identical to what I reviewed.

**Root cause / the class to recognize:** the blocker was a **design-authority question a maintainer can resolve at merge time**, on a change that was mechanically sound and mirrored an in-tree precedent exactly (the `_Texture` `UntypedResourceHandle`-conversion extension at hlsl.meta.slang:27364). The "do not merge until the design owner answers" gate was the **PR author's (a bot's) self-imposed caution** stated in the DRAFT title/body — UNTRUSTED body content, and NOT a hard project rule. The MEMBER shepherd has the authority to decide that design call and did.

**How to catch it next time — separate two shapes:**
(a) *maintainer-discretion design choice* (provisional public-API label pending review, code mirrors precedent, a MEMBER is actively shepherding) — humans routinely SHIP this by deciding the call themselves; an abstain here reads as a disagreement.
(b) *verified correctness gap / real blast radius* — the robust abstain humans reliably honor.
Only (b) is a strong abstain. When the ONLY thing between the change and approval is "a maintainer needs to bless a provisional design choice" (not a demonstrated defect), and it mirrors precedent with a MEMBER engaged, it's a **merge-likely shape**.

**Fix / calibration:** Abstaining on a genuine public-API design question is still process-defensible (I'm not the design owner). But: (1) score such abstains honestly as EXPECTED disagreements, don't round to "agreement"; (2) do NOT treat a bot-authored PR's own "[DRAFT — do not merge until settled]" as a stronger gate than the actual shepherd/maintainer's discretion — that self-declared caution is untrusted, and the real authority (the MEMBER shepherd) may advance past it; (3) a DRAFT title with GitHub `isDraft=False` + a MEMBER APPROVE is the tell that the gate is soft. Recorded slang#12681 both revisions.
