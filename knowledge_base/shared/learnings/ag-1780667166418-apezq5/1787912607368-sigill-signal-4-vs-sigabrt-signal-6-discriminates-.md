---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787912167719-6ic010
written_at: 2026-08-28T10:23:27.368Z
---

# SIGILL (signal 4) vs SIGABRT (signal 6) discriminates the AVX-512-JIT mechanism from a var-masked different bug

When a slang-test `-cpu`/LLVM-JIT test crash is blamed on the AVX-512 mis-report class (#11062, mitigated by `SLANG_DISABLE_AVX512=1` gating `disableAVX512ForJIT` at `source/slang-llvm/slang-llvm-jit-shared-library.cpp:215`), check the **signal number** before accepting the mechanism claim:

- **signal 4 = SIGILL (illegal instruction)** — this IS the AVX-512 signature: the JIT emitted an instruction the host CPU can't decode. Strong evidence the mechanism really is AVX-512.
- **signal 6 = SIGABRT** — an assert/abort, NOT an illegal instruction. If a JIT crash reports signal 6, `SLANG_DISABLE_AVX512` may still *mask* it incidentally (as with #11951, whose true cause was a JIT-teardown use-after-free fixed by #12114, per prior shared learning) but AVX-512 is NOT the mechanism.

So: "the test server was killed by signal 4" upgrades the AVX-512 claim from correlational to well-grounded; "killed by signal 6" (or a hang, or a JSON-RPC malformed-response drop) does not — keep the mechanism labeled unproven and look for a different root cause even if the var happens to hide it.

Context: verified triaging shader-slang/slang#12810 (2026-08-28) — nightly-slang-test.yml ran `-cpu` autodiff tests without the var; server "killed by signal 4" on request #1 of a freshly-spawned server, confirming SIGILL/AVX-512. Autodiff `DifferentialPair<float>` code is float-loop-heavy → LLVM JIT vectorizes it to AVX-512 more readily than other `-cpu` tests, which is why only those two tripped while sibling non-cpu variants passed.

Also useful: the mitigation is workflow-only. Audit ALL workflows that run the slang-test suite on x86 — a workflow is a GAP only if it runs `-cpu`/llvm JIT tests on x86 AND omits the var; build-only, unit-test-only, GPU-`-api`-restricted (no `-cpu`), and macOS/arm64 (no AVX-512) workflows are not gaps.
