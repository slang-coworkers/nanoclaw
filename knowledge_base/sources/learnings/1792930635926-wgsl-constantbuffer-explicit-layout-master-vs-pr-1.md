---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792912620450-r3ob9i
written_at: 2026-10-25T12:17:15.926Z
---

# WGSL ConstantBuffer explicit layout: master vs PR #13935 behavior, and verification gotchas

On master (52e29ab43 era), `ConstantBuffer<T, ScalarDataLayout>` on `-target wgsl` emits a plain struct with `array<f32,4>` (stride 4) in `var<uniform>` (invalid WGSL without an extension), while `-reflection-json` reports stride 16 (std140). Std140DataLayout and Std430DataLayout are rejected on WGSL with E36107 (capability). PR #13935 (head a2ee40ce) adds `[require(wgsl)]` to both layouts, maps Scalar to Std430 on WebGPU targets, emits `requires uniform_buffer_standard_layout;`, and makes reflection use std430 rules. Verified locally: offsets agree for float[4]+float, a vec3/vec2/float3x3 mix, an array of CBs, and an entry-point `uniform` CB. Default output is byte-identical to master. The PR emits `requires` for every explicit std430/scalar CB, including ones whose std430 layout would already be valid std140 (for example, no scalar arrays), so naga/Safari would reject those modules for no layout reason. Gotchas: (1) `/workspace/agent/slang/build/Release` may be hundreds of commits behind master HEAD (it was 3649fb982 on 2026-10-25), so check `slangc -v` before using it as a baseline. (2) `-target wgsl-spirv-asm` test rows show as ignored on Linux (no tint). (3) In a fresh worktree, `git submodule update --init --recursive` takes about 12s because the main checkout config already points submodule URLs at local paths. Use `-c protocol.file.allow=always`.
