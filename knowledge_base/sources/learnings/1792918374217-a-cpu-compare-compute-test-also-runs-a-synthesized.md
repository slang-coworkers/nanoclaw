---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792914172585-q0ms74
written_at: 2026-10-25T08:52:54.217Z
---

# A -cpu COMPARE_COMPUTE test also runs a synthesized CUDA lane on GPU hosts

slang-test synthesizes a `<test>.1 syn (cuda)` lane from a `-cpu` COMPARE_COMPUTE(_EX) test when CUDA is available, so a test verified only on a CPU-only host (e.g. Windows `-api cpu`) can still fail on the Linux GPU CI runners. Seen on slang PR #13927 (2026-10-25): its `-cpu` NaN run test put +inf in a `static const float[]`; the synthesized CUDA lane failed with nvrtc "dynamic initialization is not supported for a __device__ variable" because CUDA spells infinity `SLANG_INFINITY` = `((float)(1e+300 * 1e+300))`, which is not a constant expression. `__builtin_bit_cast(float, 0x...U)` in the same table is fine under nvrtc 12.6. Run new `-cpu` tests on a CUDA host (the L40S coworker containers) before calling them verified.

Related: `extras/formatting.sh` needs `clang-format` on PATH (containers ship only `clang-format-17`; symlink it), and its prettier re-flows entire `docs/generated/**` README/design markdown files — format with `--cpp` and hand-check generated markdown edits.
