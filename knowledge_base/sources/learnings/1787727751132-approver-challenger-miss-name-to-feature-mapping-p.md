---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787726349390-im16gm
written_at: 2026-08-26T07:02:31.132Z
---

# [approver/challenger-miss] name-to-feature mapping PRs — verify the RESOLVED feature's GRANULARITY, not just that the name parses

**Symptom.** On shader-slang/slang PR #12735 (render-test: resolve cooperative-matrix-2 sub-feature names to a real RHI feature), my challenger cleared the change to WOULD_APPROVE. It mapped 5 distinct `VK_NV_cooperative_matrix2` sub-feature NAMES (reductions, conversions, per-element-operations, tensor-addressing, block-loads) all onto the single `rhi::Feature::CooperativeMatrix2`. DECISION_REVIEW (codex) caught a real gap I missed and I reversed to ABSTAIN_POLICY / CHALLENGER_CONCERN.

**Root cause — I answered the wrong half of the question.** For a NAME→FEATURE mapping PR there are TWO questions:
1. Does every name RESOLVE / parse? (I enumerated the whole test corpus, confirmed the 5 names == the 5 aliases and no name regresses to a loud parse-fail. TRUE but incomplete.)
2. Is the resolved feature at the RIGHT GRANULARITY for what the test needs? (I never asked this.)

`VkPhysicalDeviceCooperativeMatrix2FeaturesNV` (`external/vulkan/include/vulkan/vulkan_core.h:24883`) exposes **7 INDEPENDENT VkBool32 bits**. slang-rhi sets `Feature::CooperativeMatrix2` from **only `cooperativeMatrixWorkgroupScope`** — verified at the PR-pinned slang-rhi commit `d6d31411a3ab`, `src/vulkan/vk-device.cpp:1130-1134` (and reads other sub-bits independently at `:2207`). So N=5 distinct capabilities collapse to 1 coarse feature bit. A device with `workgroupScope=true` but a specific sub-bit `false` would now RUN a sub-feature-gated test instead of SKIP — the exact opposite of the PR's stated "runs on capable hw, skipped elsewhere" intent, on the very NVIDIA hardware it targets.

**Why the cheap probe created false confidence.** The corpus-enumeration reflex I'd built on the sibling PR #12734 ("verify a coopmat gating claim by the corpus, not by name inference") answered question 1 crisply and FELT like the whole risk. A clean, cheap, decisive probe can mask an unasked expensive one. The narrowing risk was real but was NOT the deepest risk.

**How to catch it.** When a PR maps names to a feature/capability, and especially when **N names collapse to 1 feature**, open the feature's **DETECTION SITE** (where the backend SETS it) and ask: does that one bit/condition IMPLY every capability the N names promise? For Vulkan, read the `VkPhysicalDevice*FeaturesNV/KHR` struct — if it has multiple independent bits and the backend keys the RHI feature off just one, the mapping is coarse. If you can't prove the implication (independent bits + no hardware), that is uncertainty with real blast radius ⇒ ABSTAIN.

**Fix / classification.** ABSTAIN_POLICY (CHALLENGER_CONCERN), not BLOCK: a standalone challenger finding with no 🔴 in the review doc binds to CHALLENGER_CONCERN (cf. #12693 — BLOCK requires a red bug IN the doc). Not WOULD_APPROVE: the conjunction broke. A maintainer who knows the hardware (whether workgroupScope implies the sub-features on all shipping NVIDIA parts) must decide; the coarse gate may be a knowingly-accepted tradeoff.

**Generalizes to:** any `-render-feature`/capability/flag → enum resolver, any place a broad feature name stands in for finer-grained device bits. "The name resolves" ≠ "the resolved feature means what the caller needs."
