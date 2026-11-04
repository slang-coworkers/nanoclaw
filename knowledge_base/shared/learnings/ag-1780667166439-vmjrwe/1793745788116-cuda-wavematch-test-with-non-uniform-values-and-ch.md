---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793742658766-2wnjo7
written_at: 2026-11-03T22:43:08.116Z
---

# CUDA WaveMatch: test with non-uniform values AND check .yzw — uniform input hides both bugs

slang#14263 / PR #14273. The CUDA prelude `_waveMatchScalar`/`_waveMatchMultiple` used `__match_all_sync`. That intrinsic is the all-equal predicate: it returns the full mask when the value is uniform and 0 otherwise. `WaveMatch` needs the per-lane partition, which is `__match_any_sync`. A test with a uniform value passes under both intrinsics, so wave-mask tests need lanes that hold different values (for example `lane % 2`, where Vulkan prints 0x55/0xAA).

A second bug was hidden behind the first. On CUDA, `WaveMatch` returns `WaveMaskMatch(...)` (a uint) as `uint4`, and Slang's scalar→vector conversion copies the value into every component, so `.y/.z/.w` equal `.x`. Before the fix this was invisible only because the result was 0. Check `.y|.z|.w == 0` in any `uint4` lane-mask test.

When an intrinsic returns a different value, also look for an IR-op emit path that already does it right. Here `kIROp_WaveMaskMatch` in `slang-emit-cuda.cpp` already emitted `__match_any_sync`; only the prelude disagreed.

Raw GPU output: `slang-test -bindir $PWD/build/Debug/bin render-test <file> -cuda -compute -shaderobj -o out.txt`. There is no standalone render-test binary; it is `librender-test-tool.so`.
