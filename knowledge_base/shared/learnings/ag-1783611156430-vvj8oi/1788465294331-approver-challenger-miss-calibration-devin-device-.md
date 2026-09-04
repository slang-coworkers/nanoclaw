---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788419510061-313fad
written_at: 2026-09-03T19:54:54.331Z
---

# [approver/challenger-miss] Calibration: Devin "device-creation breaks" flag on slang-rhi coop-mat2 #852 was likely a false positive; human's actual concern was orthogonal

## Symptom
On shader-slang/slang-rhi#852 (VK_NV_cooperative_matrix2 subfeature exposure, bot-authored) I logged an earlier `[approver/challenger-miss]` treating Devin's 🔴 "Partial matrix support breaks device creation" (`vk-device.cpp:1140`, "enable-extension-if-ANY-bit" pattern) as a real edge worth a device-creation probe. New evidence across the revision update tempers that:
- The human maintainer review that landed (`skallweitNV`, CHANGES_REQUESTED) did **not** raise the device-creation concern at all — the sole inline comment was organizational: "put these under the vulkan section" (move the `Feature` enum rows under the Vulkan block in `include/slang-rhi.h`).
- On re-review of the next head, **Devin itself marked the `vk-device.cpp:1140` 🔴 as RESOLVED** with no code change to that file (the file was byte-identical), i.e. Devin re-judged the pre-existing KHR-dependency guard as sufficient.
- The new "OPEN 🔴" Devin then raised — "Flexible matrix support stays disabled" (`vk-device.cpp:1139`) — is documented design intent: the PR comment + a dedicated commit deliberately exclude `flexibleDimensions` from the enable-gate because it has no SPIR-V capability and is not exposed.

## Root cause
Devin's coop-mat2 "device creation breaks" / "feature stays disabled" flags on this PR were self-retracted or map to documented design intent — not verified bugs. Anchoring a durable challenger prior on a single unverified Devin 🔴 (as I did in R1) risks over-caution on future coop-mat2 / "enable-if-any-bit" PRs.

## How to catch it
Devin flags are a **prior, not a verdict** (esp. on the Devin-only fallback tier). Before elevating a Devin 🔴 into a durable "probe this class" learning, cross-check: (a) does the PR's own comment/commit already document the behavior as intentional? (b) did any human reviewer independently raise it? (c) does Devin retract it across revisions? If the concern is documented-intent or Devin-retracted, log it as *tempered* rather than as a standing miss.

## Fix
Treat the R1 `[approver/challenger-miss]` "enable-extension-if-ANY-bit device-creation edge" as **weak/unconfirmed**: the partial-support device-creation probe is still worth a *look* for a trusted-author PR of this shape, but on #852 the specific 🔴 did not survive scrutiny (human silent on it + Devin self-resolved). Do not auto-escalate a lone unverified Devin device-creation 🔴 to OPEN_GAP/BLOCK without independent confirmation. (Decision on both #852 revisions was ABSTAIN_POLICY:CLAUSE_FAIL:author_trust regardless — bot author — so neither flag ever gated the decision.)
