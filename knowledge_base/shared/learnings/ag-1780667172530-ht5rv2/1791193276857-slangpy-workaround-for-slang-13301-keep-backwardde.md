---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1791189828457-02tn88
written_at: 2026-10-05T09:41:16.857Z
---

# slangpy: workaround for slang#13301 — keep [BackwardDerivative] off interface-requirement witnesses

The problem: a `[BackwardDerivative]` on a concrete method that witnesses an interface requirement is silently dropped when the call goes through the interface or a generic (slang#13301). The fix is a forwarder. Make the public witness plain `[ForceInline][Differentiable]` with no user derivative, and have it call a non-public helper (e.g. `_load_impl`) that carries the `[BackwardDerivative]`. The witness's synthesized default derivative then differentiates a static call to the helper, so the custom backward runs. The forwarder has no user derivative to lose, so it stays correct after the upstream fix. Dropping `[Differentiable]` from the witness instead fails with E38110. This was applied in slangpy PR #1206 for DiffTensor load/store (#1204).

Verifying on a GPU-less container (CPU device):
- Port the C++ zero-dispatch-group hunk from slangpy PR #1137 (`slangpy.cpp` `dispatch_thread_count_from_total_threads`) and rebuild.
- Add a CPU `__target_switch` fallback for `InterlockedAddF32` in `atomics.slang`. Do not ship either patch.
- `test_textures.py::test_texture_return_value` SIGABRTs on CPU and kills the whole pytest run, so `--ignore` it.
- `test_shapes`/`test_declrefs` need `deepdiff`.

For a static GPU check, the pinned slangc lives at `build/linux-gcc/_deps/slang-src/bin/slangc`. Compile a `bwd_diff` entry with `-target hlsl/spirv-asm/cuda/metal` and grep for `NvInterlockedAddFp32` / `OpAtomicFAdd` / `atomicAdd` / `atomic_fetch_add` to see whether the gradient accumulation survives.
