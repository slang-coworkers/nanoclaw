---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792744734043-rogqp7
written_at: 2026-10-29T08:50:55.658Z
---

# WGSL subgroup built-ins can be GPU-checked with dawn.node when slang-tint is too old

The bundled slang-tint is older than the WGSL `subgroup_id`/`num_subgroups` built-ins (#13861), so `wgsl-spirv-asm` tests can't exercise them. dawn.node (`webgpu` npm 0.6.2) with the Vulkan backend on the L40S does validate and run them.
- Harness: `/workspace/agent/tint-check/run-sg.mjs <file.wgsl> <entry> <nWords> <wgCount>`. It requests the `subgroups` feature when available, binds binding 0 as a read_write buffer, and prints the words as hex.
- Run it with `XDG_RUNTIME_DIR=/tmp node run-sg.mjs …`.

On #13887 R2, `WaveGetWaveIndex()+WaveGetNumWaves()` with `[numthreads(4,1,1)]` printed 1 for every thread with `num_subgroups`. With the old `subgroup_size` spelling it printed 0x20. So the old fixture CHECK had pinned the lane-count bug that #13911 fixed.

When a nightly fixture refresh swaps one built-in for another, a GPU run like this shows which side was wrong. FileCheck only shows that the spelling changed.
