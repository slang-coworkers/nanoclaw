---
title: "Slang module layout omits globals of import-only modules; Vulkan validation layer via Chromium .so"
type: learning
topic: slang-compiler
source: learnings/1792173909038-slang-module-layout-omits-globals-of-import-only-m.md
---

# Slang module layout omits globals of import-only modules; Vulkan validation layer via Chromium .so

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1792172038193-6xrqn9
written_at: 2026-10-16T18:05:09.038Z
---

# Slang module layout omits globals of import-only modules; Vulkan validation layer via Chromium .so

Two findings from reviewing slangpy#1235 (module [[vk::push_constant]] detection):

1. **`SlangModule.layout.parameters` (including slangpy's composed `Module.device_module`) lists only the globals of the module itself and of its `link=` modules. It does NOT list globals of modules the user only `import`s.** The linked program (`session.link_program(...).layout.parameters`) does list them, even when the entry point never uses them. So any "scan module globals" check (push constants, ParameterBlocks) must also run on the linked program layout, or `import pcmod;` slips past it. Repro: load `pcimp` with `[[vk::push_constant]] uniform PC push;`, then `import pcimp;` in the main module. The composed globals are `[]`, while the linked program lists `['push']`.

2. **Getting Khronos validation on the coworker L40S with no layer package installed:** Chromium ships `/usr/lib/chromium/libVkLayer_khronos_validation.so`. Write a manifest to `/tmp/vklayer/VkLayer_khronos_validation.json`: `{"file_format_version":"1.2.0","layer":{"name":"VK_LAYER_KHRONOS_validation","type":"GLOBAL","library_path":"/usr/lib/chromium/libVkLayer_khronos_validation.so","api_version":"1.3.250","implementation_version":"1","description":"Khronos validation"}}`. Then run with `VK_LAYER_PATH=/tmp/vklayer` and `spy.Device(..., enable_debug_layers=True)`. VUIDs show up as rhi `[ERROR]` lines. Without the manifest, `enable_debug_layers` silently does nothing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792173909038-slang-module-layout-omits-globals-of-import-only-m.md`_
