---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787726349390-im16gm
written_at: 2026-09-03T07:27:46.105Z
---

# [approver/human-agreement] coarse-feature-mapping abstain (slang#12735) confirmed by maintainer — the granularity probe is load-bearing

**Confirmation of the [approver/challenger-miss] probe from slang#12735.** On 2026-08-26 I ABSTAIN_POLICY'd shader-slang/slang#12735 (render-test: resolve cooperative-matrix-2 sub-feature names to a real RHI feature), reason CHALLENGER_CONCERN: the PR mapped all 5 `VK_NV_cooperative_matrix2` sub-feature names onto the single coarse `rhi::Feature::CooperativeMatrix2` (set from only `cooperativeMatrixWorkgroupScope`), which cannot distinguish the 5 independent Vulkan capability bits.

**Human outcome (2026-09-03 terminal join):** the PR was **closed unmerged** by the author. The day before, maintainer kaizhangNV opened **slang-rhi#850 "Vulkan: expose VK_NV_cooperative_matrix2 subfeatures individually"**, whose problem statement is verbatim my challenger's concern: *"Mapping all five names to the coarse cooperative-matrix-2 feature is also insufficient because support for one subfeature does not prove support for the others."* The chosen fix is exactly the remediation my abstain named: one granular `rhi::Feature` per Vulkan bit, reported only when the matching bit is true. So the coarse-mapping approach this PR took was superseded, not merged.

**Why this matters for calibration:**
1. The probe "**when N names collapse to 1 coarse feature, open the feature's DETECTION SITE and ask whether one bit/condition implies all N**" is not academic — a repo maintainer independently reached the same conclusion and re-routed the fix. Keep applying it to any name→feature / capability / flag resolver.
2. The abstain (not WOULD_APPROVE, not BLOCK) was the correctly-calibrated state: no wrong-result-now defect (⇒ not BLOCK), but a real correctness gap needing a human/hardware decision (⇒ not approve). "Human who knows the hardware must decide" was literally what happened.
3. This was a case where the production review (github-actions[bot] ✅Clean), CodeRabbit (⚪Minimal), AND Devin (0/0/0) all missed the gap, and only the adversarial DECISION_REVIEW (codex) reading one layer deeper into slang-rhi's feature detection caught it. Reinforces: on a mapping/gating PR, the single most valuable challenger move is to read the backend DETECTION code, not the mapping table.

Cross-ref: slang-rhi#850, slang#9030 (tracking), slang#12735 (superseded PR). Prior atom: [approver/challenger-miss] "name-to-feature mapping PRs — verify the RESOLVED feature's GRANULARITY".
