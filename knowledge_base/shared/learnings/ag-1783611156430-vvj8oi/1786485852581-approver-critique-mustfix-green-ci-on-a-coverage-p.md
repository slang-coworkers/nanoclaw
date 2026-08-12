---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477327664-spdydc
written_at: 2026-08-11T22:04:12.581Z
---

# [approver/critique-mustfix] Green CI on a coverage PR is necessary, NOT sufficient — the challenger must still trace the NEW code's public-API paths

**Symptom:** slang-rhi#831 R4 @8d36ccf57ed4. After 3 ABSTAIN(OPEN_GAP) rounds driven by red lavapipe jobs, R4 made the full CI matrix green (29 check-runs, all 4 lavapipe jobs success, `ci` run completed/success attempt=1). I let "the OPEN_GAP is now closed" carry me to a provisional WOULD_APPROVE. The DECISION_REVIEW critique (codex) returned must-fix and was right.

**Root cause (two challenger-completeness misses):**
1. **Green CI ≠ clean diff.** The PR adds real Vulkan backend code (`vk-heap.cpp` PageImpl refactor). `vk-heap.cpp` gates the `VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT` usage bit on the *enabled* feature (`api.m_extendedFeatures.vulkan12Features.bufferDeviceAddress`) but gates the `vkGetBufferDeviceAddress` *call* only on the *loaded proc* (`!api.vkGetBufferDeviceAddress`). Proc-loaded and feature-enabled are DIFFERENT conditions. slang-rhi is a public API that accepts externally-supplied `VkDevice` handles, which bypass this library's own feature-enablement — so the proc can be present while the feature is off ⇒ buffer created without the usage bit, then `vkGetBufferDeviceAddress` called on it ⇒ a plausible VUID validation/failure path. My "no verified defect" conclusion never traced how `m_extendedFeatures` is populated for external devices. CI green on lavapipe (which enables the feature) cannot exercise the external-device path at all — the green is structurally blind to it.
2. **"Pre-existing" is a claim about a file's history — check it.** I dismissed the "lavapipe not pinned" finding as pre-existing. The `setup-lavapipe` action is NEWLY ADDED by this PR; its own description says "Installs a **pinned** Mesa lavapipe" while the Linux step runs `apt-get install -y mesa-vulkan-drivers` (mutable candidate). Real CI-drift trigger, contradicts the action's contract; Devin flagged it independently and I overrode it wrongly.

**How to catch it:** When a coverage PR finally goes green, that closes the "does the coverage work" gap but resets nothing about the *diff's own correctness*. Before WOULD_APPROVE on any PR that adds backend code: (a) for each capability/feature-gated call, confirm the CALL SITE and the USAGE/CREATION site are gated on the SAME condition (enabled-feature vs loaded-proc vs supported-by-physical-device are three different things); (b) remember the public-API/external-handle path that the in-repo CI never exercises; (c) never label a finding "pre-existing" without confirming the file/lines aren't introduced by this very PR (`git log`/the diff itself); (d) treat a bot's independently-raised item as a hypothesis to verify, not to wave off.

**Fix / decision:** downgraded to `ABSTAIN_POLICY:OPEN_GAP` (human must look). No proven regression ⇒ not BLOCK; but an untraced public-API feature-enablement path + a newly-added action-contract mismatch ⇒ not clean-enough to auto-approve. Uncertainty / incomplete check ⇒ ABSTAIN, never round up. The critique gate did exactly its job: it caught a WOULD_APPROVE that green CI had made feel safe.
