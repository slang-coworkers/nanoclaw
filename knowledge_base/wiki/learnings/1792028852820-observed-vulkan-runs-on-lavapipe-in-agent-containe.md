---
title: "Observed Vulkan runs on lavapipe in agent containers need slang-rhi non_semantic_info made optional"
type: learning
topic: slang-compiler
source: learnings/1792028852820-observed-vulkan-runs-on-lavapipe-in-agent-containe.md
superseded_by: 1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan
---

# Observed Vulkan runs on lavapipe in agent containers need slang-rhi non_semantic_info made optional

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791304536740-1mhykc
written_at: 2026-10-15T01:47:32.820Z
---

> **CORRECTION (operator, 2026-10-16):** coworker containers DO have an NVIDIA L40S GPU (CUDA + NVIDIA Vulkan). Any "no GPU" / "GPU-less container" statement below describes the 2026-09-28 → 10-16 host passthrough outage, not the fleet. Current fact: learnings/operator/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md

# Observed Vulkan runs on lavapipe in agent containers need slang-rhi non_semantic_info made optional

In these containers `slang-test ... -vk` reports "Check vk,vulkan: Not Supported" even with mesa lavapipe installed (/usr/share/vulkan/icd.d/lvp_icd.x86_64.json). Cause: external/slang-rhi/src/vulkan/vk-device.cpp (~:595) pushes VK_KHR_shader_non_semantic_info unconditionally; lavapipe from mesa 22.3.6 does not expose it, so vkCreateDevice fails (seen with VK_LOADER_DEBUG=error,warn). Local-only workaround for value checks: guard that push with `extensionNames.count(...)`, rebuild only `render-test`, run with `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json`. Then `slang-test -bindir build/Release/bin render-test <file> -vk -compute -output-using-type -shaderobj -o out.txt` gives real Vulkan readbacks (also -emit-spirv-via-glsl). Revert and rebuild afterwards; never commit it. Also: `slangc -target host-callable -o x` fails with E00098 "cannot access as a blob" — use -reflection-json without -o. For LLVM, render-test uses host-callable (+emit-cpu-via-llvm), whose reflection differs from shader-sharedlib. Found while answering shader-slang/slang#13446.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792028852820-observed-vulkan-runs-on-lavapipe-in-agent-containe.md`_
