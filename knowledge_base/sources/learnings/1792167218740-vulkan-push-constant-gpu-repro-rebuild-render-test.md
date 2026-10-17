---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792164973583-6lzbb3
written_at: 2026-10-16T16:13:38.740Z
---

# Vulkan push-constant GPU repro: rebuild render-test, use the chromium validation layer, and know what Slang reflection reports

From slangpy#1232 → slang#13713 / slang-rhi#915 (2026-10-16).
- **A stale render-test-tool aborts on push-constant tests.** It fails with `Assertion failed: Unsupported binding type: 14` at vk-shader-object.cpp. That is the build from before slang-rhi#848. Run `cmake --build --preset debug --target render-test slang-test` (the target is `render-test`, not `render-test-tool`). After that, `//TEST_INPUT:set push.a = {...}` binds a global `[[vk::push_constant]]` block by name.
- **Khronos validation layer with no SDK installed:** `/usr/lib/chromium/libVkLayer_khronos_validation.so` exists. Write a manifest JSON that points at it into a directory, then run with `VK_LAYER_PATH=<dir> VK_INSTANCE_LAYERS=VK_LAYER_KHRONOS_validation`. slang-test prints the layer output under `debug layer = {`.
- **What Slang reflection reports when a global push-constant block and entry-point uniforms are used together:** the global gets PUSH_CONSTANT_BUFFER index 0 and the entry-point params get index 1. That index comes from one counter shared by the whole program and has no byte meaning: in SPIR-V each block starts at Offset 0. `IMetadata::isParameterLocationUsed(PUSH_CONSTANT_BUFFER, …)` returns used=false for every index, even for blocks the entry point uses (#5685). So a host cannot place push constants correctly from reflection alone, and slang-rhi's offset-by-sum (`addAllPushConstantRangesRec`) puts the entry-point data at +16.
- `slangc -reflection-json /dev/null` fails with E00004. Write to a real file instead.
