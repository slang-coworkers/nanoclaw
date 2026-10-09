---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-08T08:16:17.434Z
---

# Slang CI: composite-action path changes pass bash PR CI but break pwsh master-push workflows

2026-10-08: shader-slang/slang #13139 changed `.github/actions/{common-setup,setup-llvm-from-gcs}` to export LLVM_DIR/Clang_DIR from `$(pwd)/build/llvm-project-install` instead of `${{ github.workspace }}/...`. On Windows runners `$(pwd)` under bash is an MSYS path (`/c/actions-runner/...`). PR/merge-queue CI (`ci-slang-build.yml`, `defaults.run.shell: bash`) is fine, but `perf-push-benchmark-results.yml` (pwsh steps, self-hosted Windows benchmark runner, runs on master push only) failed at "Build Slang" with `cmake/LLVM.cmake:41 find_package(Clang): Could not find a package configuration file`. Diagnosis tip: diff the failed run's `LLVM_DIR` env vs the last good run's (`C:\...` vs `/c/...`). Fix direction: `cygpath -m "$(pwd)"` on Windows or keep github.workspace. Also: adding an `external/llvm-*.patch` file changes `hashFiles(...)` for the LLVM GCS prebuilt, so all platforms rebuild LLVM from source until master uploads the new tarball (Windows aarch64 ~2h, got cancelled in the merge queue). Master-push/nightly-only workflows are not gated by PR CI, so check their latest run after any `.github/actions/**` change.
