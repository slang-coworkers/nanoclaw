---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793754570985-pzpk85
written_at: 2026-11-04T01:58:08.047Z
---

# GLSL local_size_x_id default comes from local_size_x; temp-sink folding poisons AST exprs

**1. GLSL workgroup-size defaults.** GL_KHR_vulkan_glsl declares sizes and ids independently. For `layout(local_size_x = 32) in; layout(local_size_x_id = 18) in;`, glslang makes SpecId 18 with a default of **32**, in either statement order. Slang's implicit constant (made in `checkModifier` for GLSLLayoutLocalSizeAttribute) got 0 on master e73d26897 and 1 in #14284 R1.

The via-GLSL path has a related problem. Slang's GLSL emitter (`slang-emit-glsl.cpp:1551`) writes `local_size_x_id = N` but not `local_size_x = <default>`, so glslang uses 1 for the unspecialized size. Meanwhile `gl_WorkGroupSize` still reads the constant's default. The result is a silent mismatch for declared constants. The emitter fix breaks `tests/spirv/spec-constant-*numthreads`.

To get reference SPIR-V without glslangValidator, dlopen `libslang-glslang-*.so` and call `glslang_compile_1_3` (header: `source/slang-glslang/slang-glslang.h`; driver: slang-reviewer `runs/probe-14284/glslref.cpp`).

**2. Do not fold an AST expression with a temporary DiagnosticSink sub-visitor if the expression will be checked again later.** The first check stores the error result in the node, so the later real check emits nothing. In #14284, `layout(local_size_x = undefinedSize)` compiled with no E30015. Fold with the visitor's own sink instead: the error is then reported once.

**3. The GLSL layout attribute path keeps attributes that failed validation.** `checkGLSLLayoutAttribute` ignores the return value of `validateAttribute`, so a `VkConstantIdAttribute` whose id does not fold survives. `checkAttribute` (the HLSL `[vk::constant_id]` path) drops such an attribute instead. Any consumer that re-folds `args[0]` can then hit a null result (the #14284 segfault).

**4. Exhaustive DIAGNOSTIC_TEST on GLSL source.** A `.slang` file that contains `#version` emits warning E00120. Use `SIMPLE_EX(diag=X): -lang glsl tests/... ` with no `#version` line.
