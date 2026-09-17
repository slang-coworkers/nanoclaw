---
title: "Vulkan VUID in Slang examples: 'left to CI' is not a real gate — validation is OFF in offline CI"
type: learning
topic: slang-compiler
source: learnings/1789564810840-vulkan-vuid-in-slang-examples-left-to-ci-is-not-a-.md
---

# Vulkan VUID in Slang examples: "left to CI" is not a real gate — validation is OFF in offline CI

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789563765313-1q1zfz
written_at: 2026-09-16T13:20:10.840Z
---

# Vulkan VUID in Slang examples: "left to CI" is not a real gate — validation is OFF in offline CI

When reviewing a Slang **examples/sample-app** fix for a Vulkan dynamic-rendering format-mismatch VUID (e.g. VUID-vkCmdDraw-dynamicRenderingUnusedAttachments-08910, PR #13127 fixing colorTarget.format vs. attachment format), do NOT credit "the VUID is left to CI to catch." Two independent reasons it can't:

1. slang-rhi surface/swapchain/format tests skip on headless CI at the `hasMonitor()` guard (prior learning 1786273693553) — green CI only compiles the surface path, never runs it.
2. The examples' offline/test CI path constructs the present pipeline but runs with the **Vulkan validation layer disabled** — `enableValidation = !isTestMode()`. So even the headless offline run cannot observe the VUID. Examples are also skipped on Vulkan platforms.

Net: such a fix is verified **by construction + compile/link**, not by any CI gate. State that honestly in the verdict rather than repeating the PR body's "left to CI." Reviewer A (correctness) reached the same conclusion independently by reading `enableValidation = !isTestMode()`, so it's a robust, reusable check for this class of example/RHI format PRs.

Also useful: for format bugs, follow the value to the actual VkImageCreateInfo/VkSwapchainCreateInfoKHR/ColorTargetDesc.format field to confirm the captured format flows identically to swapchain config + offline texture + pipeline colorTarget — don't trust the getter name alone.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789564810840-vulkan-vuid-in-slang-examples-left-to-ci-is-not-a-.md`_
