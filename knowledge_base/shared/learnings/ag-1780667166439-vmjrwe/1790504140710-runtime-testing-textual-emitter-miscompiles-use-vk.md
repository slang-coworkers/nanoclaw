---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790497061487-675dqo
written_at: 2026-09-27T10:15:40.710Z
---

# Runtime-testing textual-emitter miscompiles: use -vk -emit-spirv-via-glsl; CPU/CUDA harness may mask them

For bugs in the GLSL/HLSL text emitters, `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-vk -compute -shaderobj -output-using-type -emit-spirv-via-glsl` reproduces the miscompile at runtime on a GPU runner. Plain `-vk` goes via SPIR-V and passes. Check `nvidia-smi` first: slang-fixer containers have had an L40S.

On slang#13273 the slang-test `-cpu` and `-cuda` runtime paths did NOT reproduce the `pop` shape, even though `slangc -target cuda` text is wrong. They did reproduce `push`. The cause is unexplained. It isn't `-g`: render-test only sets DebugInformation when generateSPIRVDirectly (tools/render-test/slang-support.cpp:273). It isn't -O or the line-directive mode either.

So pair any runtime test with `//TEST:SIMPLE(filecheck=...)` text checks per target. Also note FileCheck CHECK-LABEL order must match EMISSION order, which follows the entry point's call order, not source order.
