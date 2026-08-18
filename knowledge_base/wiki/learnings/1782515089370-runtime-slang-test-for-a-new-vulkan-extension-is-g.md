---
title: "Runtime slang-test for a new Vulkan extension is gated on slang-rhi harness support (abort/VK_KHR_shader_abort #11790)"
type: learning
topic: slang-compiler
source: learnings/1782515089370-runtime-slang-test-for-a-new-vulkan-extension-is-g.md
---

# Runtime slang-test for a new Vulkan extension is gated on slang-rhi harness support (abort/VK_KHR_shader_abort #11790)

# Runtime slang-test for a brand-new Vulkan extension ⇒ first check slang-rhi can express it

**Context:** issue shader-slang/slang#11790 asked for a *runtime* slang-test exercising the `abort` intrinsic (`VK_KHR_shader_abort`, shipped compiler-side in #11542). Feasibility verdict: **NOT authorable in the current harness** — the gap is purely runtime/RHI, not compiler.

## The reusable rule
A runtime slang-test (`COMPARE_COMPUTE`/`EXECUTE`/etc.) for a feature that depends on a **device extension/feature** can only exist if **slang-rhi** already plumbs it. Before promising such a test, verify three things in this order:
1. **slang-rhi `Feature` enum** has an entry for it. It's the macro `SLANG_RHI_FEATURES(x)` in `include/slang-rhi.h` (a name→enum X-macro). No entry ⇒ the backend can't enable the device feature/extension, and there's nothing to gate on.
2. **The test-side gate** is `-render-features <name>` in the `//TEST:` directive → `render-test` maps name→`rhi::Feature` (`tools/render-test/render-test-main.cpp`, `_getFeatureFromName`), and **skips via `SLANG_E_NOT_AVAILABLE`** when `hasFeature(feature)` is false (~`render-test-main.cpp:2010-2020`). Unknown names are **rejected at option parsing** (`tools/render-test/options.cpp` `isValidFeatureName` → `SLANG_FAIL`) — you can't smuggle a phantom feature name through as a gate.
3. **The execution model fits.** Runtime directives do dispatch → readback output buffer → compare. If the feature's success condition is anything other than "valid output buffer" (here: `abort` causes **device loss**, and the message is retrieved via `VK_KHR_device_fault` / `vkGetDeviceFaultDebugInfoKHR` + `VkDeviceFaultShaderAbortMessageInfoKHR`), the readback-compare model **can't validate it** — it needs a new render-test mode. slang-rhi pin `687dc18` had zero device-fault support.

## Verification method that matters
Check claims against the **pinned** slang-rhi SHA, not a working tree: `git grep -i <terms> <pinned-sha> -- src include` searches that exact commit object regardless of checkout state. The slang submodule pin lives at `git ls-tree <slang-master> external/slang-rhi`. A standalone slang-rhi clone may be at a *different* commit than the pin — always grep the pinned SHA explicitly. (codex independently confirmed via the populated submodule `slang/external/slang-rhi` at the pin.)

## Process note
For a maintainer's "give me a PR" on a harness-blocked feature: don't force a non-runnable scaffold (a runtime test gated on a non-existent feature either fails option-parsing or always-fails on device loss = the "fake PR" to avoid). Report-only with a precise prerequisite roadmap, and hand the scaffold-vs-prereqs-first choice back to the RHI owner. Phrase public "no support exists" claims as measured/pinned ("as of slang-rhi `687dc18`, search of src/+include/ finds none"), never absolute.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782515089370-runtime-slang-test-for-a-new-vulkan-extension-is-g.md`_
