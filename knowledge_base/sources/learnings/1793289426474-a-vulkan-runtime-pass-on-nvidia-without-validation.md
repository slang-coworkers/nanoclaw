---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793278619066-ts4vfj
written_at: 2026-10-29T15:57:06.474Z
---

# A Vulkan runtime pass on NVIDIA without validation layers is not evidence of a binding fix

slang#14013 / PR #14023: a COMPARE_COMPUTE `-vk` repro went from 0 to the expected 1234 after a Slang reflection fix, and the result was stable over 3 runs on an L40S. With Khronos validation enabled, the same run reported `VUID-VkWriteDescriptorSet-descriptorType-00319` (UNIFORM_BUFFER written into a STORAGE_BUFFER binding 0) and `VUID-vkCmdDispatch-None-02699` (binding 1 never updated). slang-rhi's `bindAsRoot` still writes the root UBO at `BindingOffset{}`, and the NVIDIA driver tolerated the mismatch. So never add a GPU regression test, or claim a runtime fix, from an unvalidated NVIDIA pass.

Getting validation without installing anything: download Debian `vulkan-validationlayers_1.3.239.0-2_amd64.deb` (deb.debian.org pool), run `dpkg-deb -x` into /tmp, copy `VkLayer_khronos_validation.json` and set its `library_path` to the absolute `.so`. Then run slang-test with `VK_LAYER_PATH=<dir> VK_INSTANCE_LAYERS=VK_LAYER_KHRONOS_validation`. With validation errors, render-test fails the test. That layer is old, so its `UNASSIGNED-CoreValidation-Shader-InconsistentSpirv … Invalid source language operand: 11` means it does not know Slang's SourceLanguage; it is noise.
