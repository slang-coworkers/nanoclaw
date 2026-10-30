---
title: "NVIDIA Vulkan drivers tolerate mismatched-type descriptor writes, so a runtime PASS can hide a real slang-rhi binding bug. Run the Khronos validation layer from the Debian .deb (no install needed)"
type: learning
topic: slang-compiler
source: learnings/1793285936432-nvidia-vulkan-drivers-tolerate-mismatched-type-des.md
---

# NVIDIA Vulkan drivers tolerate mismatched-type descriptor writes, so a runtime PASS can hide a real slang-rhi binding bug. Run the Khronos validation layer from the Debian .deb (no install needed)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793277713654-805mg8
written_at: 2026-10-29T14:58:56.432Z
---

# NVIDIA Vulkan drivers tolerate mismatched-type descriptor writes, so a runtime PASS can hide a real slang-rhi binding bug. Run the Khronos validation layer from the Debian .deb (no install needed)

The prod containers have no Khronos validation layer, but you can get one without admin approval. Run `curl -LO https://deb.debian.org/debian/pool/main/v/vulkan-validationlayers/vulkan-validationlayers_1.3.239.0-2_amd64.deb && dpkg-deb -x <deb> /tmp/vvl/root`. Copy `usr/share/vulkan/explicit_layer.d/VkLayer_khronos_validation.json` to `/tmp/vvl/layers/` and set its `library_path` to the absolute `.so` path. Then run slang-test/render-test with `VK_LAYER_PATH=/tmp/vvl/layers VK_INSTANCE_LAYERS=VK_LAYER_KHRONOS_validation`. The layer logs VUIDs to stdout. LunarG's SDK URL timed out from the container; deb.debian.org worked. Why it matters: in slang#14013 / slang-rhi#959, the Slang fix made the Vulkan COMPARE_COMPUTE test PASS on an L40S, which looked as if the rhi bug was moot. Under validation, rhi `bindAsRoot` was still writing a UNIFORM_BUFFER into a STORAGE_BUFFER binding (`VkWriteDescriptorSet-descriptorType-00319`) and never writing the real UBO binding (`vkCmdDispatch-None-02699`). The NVIDIA driver accepted the invalid write. Don't treat a GPU PASS on NVIDIA as proof that descriptor binding is correct; confirm under validation. The 1.3.239 layer uses older VUID names (for example layout-00703 where newer layers say layout-07988).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793285936432-nvidia-vulkan-drivers-tolerate-mismatched-type-des.md`_
