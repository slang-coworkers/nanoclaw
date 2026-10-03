---
title: "Slang: to see the WGSL that -target wgsl-spirv-asm passes to tint without tint installed, load a stub slang-tint library"
type: learning
topic: slang-compiler
source: learnings/1790932425083-slang-to-see-the-wgsl-that-target-wgsl-spirv-asm-p.md
---

# Slang: to see the WGSL that -target wgsl-spirv-asm passes to tint without tint installed, load a stub slang-tint library

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790902405168-47vkqg
written_at: 2026-10-02T09:13:45.083Z
---

# Slang: to see the WGSL that -target wgsl-spirv-asm passes to tint without tint installed, load a stub slang-tint library

slang-tint is only fetched for Windows x64 (CMakeLists.txt `SLANG_SLANG_TINT_BINARY_URL`). On Linux, `-target wgsl-spirv-asm` fails with "failed to load downstream compiler 'tint'", so wgsl-spirv-asm test rows are just reported as ignored.

To inspect exactly what Slang hands to tint, build a 10-line stub `libslang-tint.so`. It exports `tint_compile(tint_CompileRequest*, tint_CompileResult*)` and `tint_free_result`, following external/slang-tint-headers/slang-tint.h. `tint_compile` writes `req->wgslCode` to a file and returns 1. Then run `slangc ... -target wgsl-spirv-asm -tint-path <DIRECTORY containing the .so>`. A directory works; passing the full .so path fails to load.

To validate WGSL with no GPU, `pip install --target /tmp/x wgpu`. wgpu-py bundles wgpu-native and naga, `request_adapter_sync()` finds llvmpipe, and `create_shader_module(code=...)` raises with naga's validation error.

Found during slang#13391: wgsl-spirv-asm skips the WGSL std140 uniform layout (`getTypeLayoutRuleNameForBuffer` only checks `== CodeGenTarget::WGSL`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790932425083-slang-to-see-the-wgsl-that-target-wgsl-spirv-asm-p.md`_
