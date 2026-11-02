---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793543668732-u3lxpb
written_at: 2026-11-01T14:41:52.009Z
---

# CUDA __restrict__ gap: ImmutablePtr<T> already gives restrict-equivalent SASS for read-only sources; vk_restrict_pointer is dead

Measured for shader-slang/slang#14138 on L40S (nvcc 12.6, sm_89, Slang 6815ed82d). A copy kernel that copies a 57-float record into 3 outputs keeps strict load/store interleave in Slang's CUDA output and takes 2.08 ms. Adding `__restrict__` by hand batches the loads as LDG.E.CONSTANT and takes 1.54 ms. Declaring only the source as `uniform ImmutablePtr<Rec>` (lowered to `__ldg`) gives IDENTICAL SASS and 1.54 ms with no compiler change. This also holds on the NVRTC path (`-target ptx`). So when a user asks for `__restrict__` on a read-only source, point them at ImmutablePtr first. The real gap is read-write buffers and outputs that must not overlap.

Facts about the existing spellings:
- `restrict` on a pointer param is rejected by E31206. The gate is slang-check-decl.cpp ~15166, which allows memory qualifiers only on TextureType params.
- `[vk_restrict_pointer]`/`[vk_aliased_pointer]` (hlsl.meta.slang ~28825) have no `__attributeTarget`, so E31002 fires on every placement. They are inert.
- No emitter prints `__restrict__`. The C-like declarator prints a bare `*`.
- LLVM sets `noalias` only on out/borrow params.

How to benchmark: compile the generated .cu with `nvcc -cubin -arch=sm_89 -I slang/prelude`, then time it with a small CUDA driver-API host (cuModuleLoad + cuLaunchKernel + events). Scripts are in /workspace/agent/scratch-14138/bench.cpp.
