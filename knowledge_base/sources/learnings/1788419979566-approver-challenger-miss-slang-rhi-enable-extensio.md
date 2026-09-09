---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788419510061-313fad
written_at: 2026-09-03T07:19:39.566Z
---

# [approver/challenger-miss] slang-rhi "enable-extension-if-ANY-bit" Vulkan feature PRs have a partial-support device-creation edge

## Symptom
On shader-slang/slang-rhi#852 ("Expose VK_NV_cooperative_matrix2 subfeatures individually", bot-authored `fix/issue-850`), the diff restructures the Vulkan coop-mat2 detection block to **enable the extension whenever ANY of the 5 sub-feature bits is supported**, then push each `Feature`/`Capability` gated on its own bit. Devin (head-current, Devin-only tier — production review skips bot fixer PRs) flagged a potential 🔴 "**Partial matrix support breaks device creation**" at `src/vulkan/vk-device.cpp:1140`. The approver ABSTAINed at Step 1 (`CLAUSE_FAIL:author_trust`, bundled v0-shadow), so the challenger never verified it — recorded as UNVERIFIED for the human.

## Root cause (hypothesis to probe, not confirmed)
The "enable if any bit set" pattern means the extension gets added to the enabled-extension / pNext chain even when only a subset of the feature struct's bits are `VK_TRUE`. If the driver/loader requires all-or-a-specific-dependency (or a bit that the code assumes but doesn't gate on) `vkCreateDevice` can fail on a partially-supporting device. The PR's own comment claims it gates KHR-coop-matrix dependency and inserts the struct once — but Devin still saw a partial-support failure path.

## How to catch it
For any slang-rhi Vulkan (or D3D/Metal) PR of the shape "enable extension X when ANY sub-bit is set, then advertise each sub-feature independently": challenger must ask **what happens on a device that supports the extension but only a subset of the bits** — does `initVulkanDevice`/`vkCreateDevice` still succeed? This is a real-blast-radius edge (device creation), not a nit. Ties to the standing gate/flag probe (a negative safety observation that "can't come out otherwise" carries no bits) and to the slang-rhi-integration prior (combined status hides red `test-slang-rhi`; confirm the RHI Vulkan job actually ran).

## Fix
When a trusted-author PR of this shape reaches Step 3, treat "enable-if-any-bit" as a trigger for the partial-support device-creation probe; a verified break is an OPEN_GAP/BLOCK, not advisory. Even on an early-return Step-1 abstain, keep surfacing Devin's head-current 🔴 in the record's challenger field + the report so the human the abstain routes to is primed.
