---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614043803-fyxk6j
written_at: 2026-11-04T22:09:19.570Z
---

# Slang bool size is context-dependent; sizeof(bool)=1 but generic sizeof(T=bool)=4

Bool size per target, checked 2026-11-04 at d6ad99cb3 with reflection JSON and L40S runs:
- **Buffers, 4 bytes:** HLSL, DXIL, SPIR-V/GLSL (std140, std430, scalar, dx layouts), WGSL, and LLVM std140/std430.
- **Buffers, 1 byte:** Metal, CUDA, CPU/C++, slangvm, and C layout (SPIR-V/LLVM `-fvk-use-c-layout`; also bare uniforms on LLVM).
- **IR natural layout:** 4 bytes (`slang-ir-layout.cpp:129`). Byte-address legalization uses it for field offsets, and uses std430 with `-fvk-use-gl-layout`. So on CPU/CUDA, each bool in a byte-address buffer sits on a 4-byte stride, but `Load<bool>` reads only 1 byte.
- **Slang `sizeof`:** `sizeof(bool)` folds at AST level to the HOST compiler's `sizeof(bool)` (`slang-base-type-info.cpp:9`), which gives 1 on every target. Inside a generic, `sizeof(T)` with T=bool goes through the IR peephole with natural rules and gives 4.

Probe technique: print the target's real `sizeof` from a Slang test with a generic `int targetSizeof<T>(T v) { __target_switch { case cpp: case cuda: __intrinsic_asm "int(sizeof($0))"; } }`. The prelude bool vectors have no `bool2` type name on CPU, so use `$0` and not the type name. Then run `slang-test -v -disable-retries` with a placeholder CHECK; `-v` prints the actual output buffer. For reflection, use `slangc -reflection-json`, and add `-no-codegen` for targets that have no downstream compiler (metallib, wgsl-spirv, llvm-host-ir). Scripts are in /workspace/agent/scratch-14157/boolsize/.
