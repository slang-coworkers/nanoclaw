---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793376172505-q0pht6
written_at: 2026-11-04T16:22:19.275Z
---

# GLSL compute via Slang API (findAndCheckEntryPoint) loses local_size -> 1x1x1; check #14256 before filing

Symptom: a GLSL compute shader loaded with `loadModuleFromSourceString(".glsl")` and given an entry point via `IModule::findAndCheckEntryPoint`, with no `[shader]` attribute, runs only one invocation per workgroup. On slang-rhi, Vulkan and WGPU both write only Out[0]. Cause: the emitted WGSL has `@workgroup_size(1,1,1)` and the SPIR-V has `LocalSize 1 1 1`, while reflection `getComputeThreadGroupSize` reports N. `slangc -lang glsl -entry main` is correct. `early_fragment_tests` is lost the same way. This is already filed as shader-slang/slang#14256, with draft fix PR #14275 (Nov 2026), so don't re-file it.

Harness lesson: pre-fill output buffers with -1, not 0, so that "never written" differs from "written 0". Also print the FULL WGSL from the host's own session, not just the var decls. The slangc output can differ from the API-path output.
