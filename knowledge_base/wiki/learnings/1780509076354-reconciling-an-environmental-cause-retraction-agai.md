---
title: "Reconciling an environmental-cause retraction against a test-config fix (map symptom→code path)"
type: learning
topic: ci-tooling
source: learnings/1780509076354-reconciling-an-environmental-cause-retraction-agai.md
---

# Reconciling an environmental-cause retraction against a test-config fix (map symptom→code path)

When a reporter retracts a bug diagnosis with an environmental cause ("it's just my old driver / my setup"), don't simply accept ("close, not our bug") or defend the prior fix. Map the *specific* observed symptom to the *specific* code path that produces it, then check whether the proposed fix covers that path.

Worked example — shader-slang/slang#11367. Test using `ByteAddressBuffer.Handle` output `0,0` instead of `10,11`; reporter first said "missing `-render-feature bindless` gate", then retracted: "invalid, it's an old driver." Reconciliation:
- The exact `0,0` symptom is produced ONLY by the render-test fall-through path (`tools/render-test/render-test-main.cpp`: `getDescriptorHandle()` fails → no-op `setBinding` on a uint2 field → zeroed handle → reads index 0 of an empty heap).
- `getDescriptorHandle()` fails iff `!m_bindlessDescriptorSet` (`external/slang-rhi/src/{vulkan,d3d12}/*-buffer.cpp`), which exists iff `hasFeature(Feature::Bindless)` (`*-device.cpp`).
- So `0,0` ⟺ `hasFeature(bindless)==false`. The `-render-feature bindless` gate skips exactly then. ⟹ "old driver" and "missing gate" are the SAME root cause at two layers, not competing diagnoses. Fix stands.

General rule that fell out of this, reusable for slang test-gating triage:
- **feature-absence** (RHI reports the feature unsupported) → the fix is a `-render-feature <name>` gate; the test skips cleanly. Symptom is typically zeroed/empty output (binding silently no-ops).
- **advertises-but-buggy** (driver reports the feature supported but miscomputes) → a render-feature gate does NOTHING (the test still runs); the correct fix is `DISABLE_TEST` + a tracking issue. Symptom is a fault or wrong-but-nonzero data, NOT silent zeros. (The BRANCH variant of #11367's test already does this for #8876 / driver 573.07 / VariablePointersStorageBuffer.)

Also: slang-rhi's Vulkan `Feature::Bindless` detection (`vk-device.cpp`, a ~14-bit descriptor-indexing + mutable-descriptor `&&` chain) trusts advertised `vkGetPhysicalDeviceFeatures2` caps with NO driver-version/vendor gate — so an old driver lacking the extensions reports bindless=false (gate helps); an old driver advertising them reports true (gate can't help).

Always include a falsification check in the GitHub reply: tell the reporter which observation would overturn the conclusion (here: "if your driver actually advertised bindless so the gated test still ran yet you saw 0,0"). Keeps the reconciliation scientific rather than authoritative.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780509076354-reconciling-an-environmental-cause-retraction-agai.md`_
