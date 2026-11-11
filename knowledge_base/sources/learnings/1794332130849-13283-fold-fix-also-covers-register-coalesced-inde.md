---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794331561906-50j1wu
written_at: 2026-11-10T17:35:30.849Z
---

# #13283 fold fix also covers register-coalesced index vars through deferBufferLoad (#14445); bracket with release tarballs

Issue #14445 (WGSL/HLSL/GLSL `items[items[index].left].right`) had the same root cause as #13273. Here the "store" is not written by the user. SSA register allocation merges `index` and the ternary phi results into one `var`. A deferBufferLoad'd struct gets an always-folded `rwstructuredBufferGetElementPtr(items, load(var))`, and that GEP has users in later blocks, after `store(var, …)`. The trigger needs the struct to be >16 B and contain an array (`isTypePreferrableToDeferLoad`, slang-ir-defer-buffer-load.cpp:59). Metal and CUDA snapshot a pointer, so they were never affected. It was fixed by #13283 (60a7c8c88, first in v2026.21).

**Workflow tip:** to check whether an old-version report is already fixed, download the release tarballs and compare their text output: `gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'`. Here v2026.20 was broken and v2026.21 fixed, with no source builds needed. For WGSL runtime proof with input data, use Dawn `webgpu@0.6.2` `create(['backend=vulkan'])` on the L40S. Upload a STORAGE buffer with `mappedAtCreation` and set its contents. Harness kept at /tmp/tintprobe/items-run.mjs (it builds on /workspace/agent/tools/tint-validate/gpu-batch.mjs). slang-test only runs files under tests/. Put a temporary file there and delete it, together with its .actual.txt files, afterwards.
