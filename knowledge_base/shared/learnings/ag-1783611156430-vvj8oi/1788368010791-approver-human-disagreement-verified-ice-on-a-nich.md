---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787880346632-5wzkpv
written_at: 2026-09-02T16:53:30.791Z
---

# [approver/human-disagreement] Verified 🔴 ICE on a niche/already-broken trigger: severity-grade before treating as block-worthy; maintainers routinely ship it

**Case:** slang#12186 (make DescriptorHandle SPIR-V rep kind-dependent under spvBindlessTextureNV). I VERIFIED a real compiler ICE at the decided head — `TextureBuffer<T>.Handle` under spvBindlessTextureNV aborts (`error[E99997] Unsupported result type for CastDescriptorHandleToResource`, exit 255; built slangc, reproduced). My recorded decision was ABSTAIN (eligibility clause-fail on a narrowed policy), but the verified 🔴 was a counterfactual BLOCK. **Outcome: BOTH maintainers approved the exact head (incl. the previously-cautious reviewer, "Looks good to me") and it merged as-is, shipping the ICE — no follow-up issue filed.**

**Lesson (transferable severity-grading of a verified 🔴 before it drives a BLOCK):**
1. **Establish the trigger's support status.** Is the failing input a MAINLINE/supported path, or a NICHE/edge combination? Here `TextureBuffer<T>.Handle` (HLSL tbuffer as a descriptor handle) is an obscure combination, distinct from the buffers/textures/AS the PR targeted.
2. **Test the trigger WITHOUT the PR's change.** If it was ALREADY broken (even with a different error) pre-PR, the PR is not regressing usable functionality — it's leaving a pre-existing edge. `TextureBuffer.Handle` failed differently even without the capability ⇒ pre-existing brokenness, not a fresh regression of something that worked.
3. **A verified ICE on a niche/already-broken path is "surface prominently to the human as a noted gap," NOT automatically block-worthy.** Maintainers routinely ship a broad, valuable fix and leave a narrow sibling edge out of scope. A BLOCK there over-calls against the maintainer bar. Grade: ICE-on-supported-path ≫ ICE-on-niche-already-broken-path.

**Second-order signal (untracked-defect):** when a verified 🔴 ships and NO follow-up issue references it, you cannot distinguish "conscious out-of-scope" from "missed." Make the upstream headline maximally actionable AND recommend a tracking issue be filed (the approver never writes GitHub, so it must flag upward). An untracked shipped ICE will bite a future user with no breadcrumb.

**Meta:** the eligibility-gate ABSTAIN happened to align with the humans' scope judgment better than a BLOCK would have — coincidence, not principle, but a reminder that deferring-to-human on an out-of-envelope PR is the safe move when the only finding is a niche-path defect.
