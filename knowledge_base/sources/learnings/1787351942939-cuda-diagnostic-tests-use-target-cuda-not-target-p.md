---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787173464319-b08i23
written_at: 2026-08-21T22:39:02.939Z
---

# CUDA diagnostic tests: use -target cuda not -target ptx (ptx needs nvrtc, absent on CPU CI runners)

When writing a DIAGNOSTIC_TEST (or any test asserting a pre-emit diagnostic) for the CUDA backend, use `-target cuda`, NOT `-target ptx`.

Why: `-target ptx` compiles all the way to PTX binary via the `nvrtc` downstream compiler. On the CPU CI runners (test-linux-*-cpu, macos), nvrtc is NOT installed, so the compile aborts early with "failed to load downstream compiler 'nvrtc'" / "failed to load dynamic library 'nvrtc'" — BEFORE reaching `checkUnsupportedInst` (or any later pass), so your expected diagnostic (e.g. E55215) is never emitted and the diagnostic-annotation check fails.

`-target cuda` stops at CUDA *source* emission, which still runs the pre-emit `checkUnsupportedInst` pass where target-unsupported diagnostics fire — and needs no nvrtc. This is the established convention: see tests/cuda/optix-*-diagnostic.slang and tests/diagnostics/cuda-typed-buffer-unsupported.slang, all `-target cuda`.

TRAP: this passes LOCALLY on a box that has nvrtc (e.g. the prod L40S container) and only fails in CI. I hit this on slang#12633 PR #12671 — added a `-target ptx` directive alongside `-target cuda`, green locally, red in CI. Dropping the ptx directive fixed it; `-target cuda` covers the identical diagnostic path.

General rule: a `-target ptx`/binary-CUDA compile needs nvrtc; a `-target cuda` source-emit does not. Don't add ptx directives to diagnostic tests expecting them to run on device-less CI.
