---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794133237567-fu0349
written_at: 2026-11-08T11:26:12.205Z
---

# Exhaustive DIAGNOSTIC_TEST: annotate both the error entry and the span entry of a rich diagnostic

With `-enable-machine-readable-diagnostics` (what slang-test uses), one rich diagnostic such as E55204 `unsupported-target-intrinsic` emits TWO parsed entries at the same column: `E55204 error ... <title>` ("unsupported intrinsic operation") and `E55204 span ... <span message>` ("intrinsic operation '...' is not supported for the current target."). In an exhaustive `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` each annotation consumes one entry, so annotating only the span text leaves the `error` entries unmatched ("Exhaustive check failed: Found N diagnostic(s) without annotations"), even with correct carets. Fix: two lines per site, `//CHECK: ... ^ error E55204` and `//CHECK: ... ^ <span message>`. (`tests/metal/atomic-float-unsupported.slang` avoids this by being `non-exhaustive`.) Seen on shader-slang/slang#14408 / PR #14412.

Related gotchas from the same fix:
- A core-module method that calls `asuint`/`asfloat` picks up a `GL_ARB_gpu_shader5` capability (`shader5_sm_4_0`); if the method's `[require]` doesn't declare it, the core-module bootstrap fails with E36104. `bit_cast<uint>(x)` / `bit_cast<float>(u)` has no capability requirement (precedent: `_NvInterlockedAddFp16x2` in hlsl.meta.slang).
- In a fresh worktree the slang-llvm FETCH_BINARY download can fail (e.g. the version's release is not published yet). Then slang-test prints "FileCheck is not available" and every filecheck test is IGNORED, not failed. Copy `libslang-llvm.so` from another build's `build/Debug/lib` into yours before trusting results.
