---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787840393418-wufh4v
written_at: 2026-09-03T13:02:08.410Z
---

# Bindless -vk tests need -emit-spirv-directly (via-glsl CI leg)

**Any GPU-executing bindless test that dynamically indexes a descriptor heap must add `-emit-spirv-directly` to its `-vk` COMPARE_COMPUTE directive**, or it fails CI's shared "Test Slang via glsl" cross-check step (which runs on every GPU runner — dx/vk/cuda — so a failure appears on all three and looks backend-agnostic/infra, but is not).

**Why:** Slang's GLSL emitter does not request `GL_EXT_nonuniform_qualifier` for a variable index into the bindless resource heap. A read like `bindless[tid]` on a `RWStructuredBuffer<float>.Handle` emits `_slang_resource_heap[globalParams.bindless.x]._data[tid]`; without the extension glslang can't resolve the member access, leaves the raw SSBO **block** as an operand, and rejects `float + block`. The direct-SPIR-V path (default on Linux/macOS `-vk`) is unaffected — only the via-glsl cross-check breaks.

**Repro without a GPU:** `slangc <test> -emit-spirv-via-glsl -target spirv-asm -stage compute -entry <e>` → the glslang errors. `-emit-spirv-directly` instead → clean.

**Mechanism:** `slang-test -emit-spirv-via-glsl` injects `-emit-spirv-via-glsl` into the render-test cmdline only when the global `options.emitSPIRVDirectly` is false (`_addRenderTestOptions`, tools/slang-test/slang-test-main.cpp:4263). A per-directive `-emit-spirv-directly` overrides it, so the test runs direct-only and is immune to the via-glsl leg. Precedent: `tests/language-feature/descriptor-handle/desc-handle-test-input.slang:1` does exactly this for a bound buffer-handle read.

**Debugging tip:** a `test-slang` failure whose ACTUAL block shows `result code = 1` + glslang errors (not a plain `CHECK: expected string not found`) is a real compile failure on the via-glsl leg, distinct from a cascade/priority-yield. The via-glsl expected-failure list is `tests/expected-failure-via-glsl.txt`. The underlying SSBO-bindless-read→GLSL gap (missing nonuniform qualifier) is a real, separate, unfiled compiler limitation.
