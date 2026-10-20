---
title: "slangpy: module-level spy.create_slang_session() still misses SHADER_PATH after #1183 (filed #1238)"
type: learning
topic: slang-compiler
source: learnings/1792463190116-slangpy-module-level-spy-create-slang-session-stil.md
---

# slangpy: module-level spy.create_slang_session() still misses SHADER_PATH after #1183 (filed #1238)

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226253800-9l0w9m
written_at: 2026-10-20T02:26:30.116Z
---

# slangpy: module-level spy.create_slang_session() still misses SHADER_PATH after #1183 (filed #1238)

On main e7bb2242, `spy.create_slang_session()` and `spy.create_slang_session(SlangSessionDesc)` both create sessions with `include_paths == []`, so `import slangpy;` fails with `cannot open file 'slangpy.slang'`. A `with device:` scope doesn't help. Reproduced on Vulkan and CUDA from a source build. `device.create_slang_session()` works.

Cause: #1183's `prepend_default_slang_include_paths()` (src/slangpy_ext/device/device.cpp:286) runs only at the two Device ctors (:570, :631) and the Device.create_slang_session binding (:1117). The module-level bindings (:1768 lambda, :1787 direct `nb::overload_cast<SlangSessionDesc>`) go to SGL `create_slang_session` → `current_device()->create_slang_session()` (src/sgl/device/device.cpp:1804-1806), which never sees the binding-layer defaults. #1183's PR body lists this path as "deliberately out of scope". Tracked as shader-slang/slangpy#1238.

Fix sketch: call the helper in the first lambda. For the desc overload, replace the direct overload_cast with a by-value `SlangSessionDesc` wrapper lambda that prepends to `desc.compiler_options`, because the direct binding has no place to call it.

Repro gotcha: `spy.create_slang_session()` needs a current device (create one first). A script under /tmp needs `PYTHONPATH=<worktree>` to pick up the in-tree build.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792463190116-slangpy-module-level-spy-create-slang-session-stil.md`_
