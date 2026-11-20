---
title: "Slang Compiler: Build & Repro Verification"
type: concept
group: slang-grab-bag
tags: [build, verification, version-string, cmake-cache, worktree, llvm-fallback, version-bracket, slangpy, default-branch, repro]
source_count: 6
---

# Slang Compiler: Build & Repro Verification

How to prove a local Slang build is what you think it is, how to answer "is this bug fixed in the compiler?" with evidence, and how to verify PR-head changes without unnecessary rebuilds.

## TL;DR

- `slangc -version` can report a stale commit hash on a fully HEAD-built tree — the CMake cache pins the version string. Prove freshness from git HEAD vs upstream `master`, object-file mtimes, and `ninja -n`; cite "master <sha>", never the version string.
- The default branch is `master`, not `main` — `commits/main` returns 404 and looks like a fetch failure. `curl -sf … | jq` masks fetch failure (empty input → jq exits 0); test output non-empty before concluding success.
- `cmake --build --target slangc slang-test` skips ALL-only standard-module artifacts — build the module/gfx/dispatcher targets too, and don't trust a shared clone of unknown age for repro semantics.
- A fresh configure can silently fall back to "without LLVM" — grep the config log before trusting FileCheck results; the fix variable is `SLANG_SLANG_LLVM_BINARY_URL` (one `SLANG_` prefix).
- For "is the bug fixed?" asks, run the exact test against a bracket of versions (oldest available, current pin, latest release) and close with ancestry (`behind_by` = 0 ⇒ fix is in master).
- slangpy test-file-only PRs can be verified at PR head with no rebuild: `git worktree add` at the head, copy the built `slangpy_ext…so` in, run pytest with the venv python.

## Proving a slangc build is at HEAD when `-version` shows a stale hash

A release build's `slangc -version` can report an OLD commit hash even when the tree is fully compiled at current HEAD — the version string is pinned by the CMake cache (`CMAKE_PROJECT_VERSION` / configure-time `configure_file` of slang-tag-version.h via cmake/GitVersion.cmake, which prefers cmake/slang_git_version + cache over fresh `git describe`), so reconfiguring does NOT refresh it. Before claiming a top-of-tree repro, don't trust `-version` and don't rebuild blindly — prove freshness with: (1) `git log -1` vs `gh api repos/shader-slang/slang/commits/master --jq .sha`, (2) object-file mtimes vs source mtime (e.g. `build/source/slang/CMakeFiles/slang-common-objects.dir/Release/slang-check-modifier.cpp.o` newer than its source), (3) `ninja -C build -n slangc` showing no pending compile steps [Proving a slangc build is at HEAD when -version shows a stale hash](../learnings/1795046111072-proving-a-slangc-build-is-at-head-when-version-sho.md).

When comparing against upstream, the repo's default branch is `master`, not `main`: `api.github.com/repos/shader-slang/slang/commits/main` and `branches/main` return 404 ("Branch not found"), which looks like a fetch failure. Also, `curl -sf … | jq …` masks a failed fetch (empty input makes jq exit 0) — capture the output and test it non-empty before concluding success [Slang repo default branch is master, not main](../learnings/1795082551482-slang-repo-default-branch-is-master-not-main.md).

## Targeted builds miss ALL-only standard-module artifacts

Test-suite runs from a worktree need more than `slangc slang-test` (new standard-modules layout, master as of 2026-11): targeting only those skips the ALL-only module producers, so ~18 suite failures are pure missing artifacts — `cannot open file 'slang/functional.slang'` (build `slang-functional-module slang-numerics-modules slang-workgraph-module slang-neural-module`), `tests/dispatcher/smoke.slang` "failed to run test" (needs the `slang-dispatcher` target, binary name `slang`), and CPU tests failing with `Failed to load DLL "gfx"` (needs the `gfx` target). A stale shared-clone Debug build can also predate harness features — a Nov-5 build's slang-test predates DIAGNOSTIC_TEST exit-code enforcement, so a clean-compiling diag test with wrong CHECK lines passed there; verify repro semantics against a fresh worktree build, not a shared clone of unknown age [Targeted slang builds miss ALL-only standard-module artifacts](../learnings/1795093206261-targeted-slang-builds-miss-all-only-standard-modul.md).

## The silent no-LLVM fallback

Configuring a fresh checkout can silently fall back to "without LLVM" because the default `SLANG_SLANG_LLVM_BINARY_URL` points at a release zip that no longer contains `libslang-llvm.so` — FileCheck-based tests then skip or become vacuous ("ignored" rows / `Check llvm: Supported` disappears). Reconfigure with an explicit working zip (`-DSL_SLANG_SLANG_LLVM_BINARY_URL=<...>/slang-llvm-v2026.22-<triple>.zip`); note the variable has ONE `SLANG_` prefix — a wrong name is accepted and ignored, which looks exactly like the original failure. Always grep the config log for "without LLVM" before trusting FileCheck results from a fresh tree (~6 min incremental rebuild after reconfiguring) [Slang build: silent no-LLVM fallback and the SLANG_SLANG_LLVM_BINARY_URL var-name gotcha](../learnings/1795099153283-slang-build-silent-no-llvm-fallback-and-the-slang-.md).

## Version-bracket repro for "is the compiler bug fixed?" asks

When a maintainer asks whether the bug behind a test skip is fixed, don't probe one version or trust the skip's age: run the exact test body against a bracket of local slang versions — oldest build available, the current pin, and the latest upstream release (slangpy's pin is `external/CMakeLists.txt:123 SGL_SLANG_VERSION`, a prebuilt download; fresh-configure a scratch worktree with `-DSGL_SLANG_VERSION=<ver>`, ~3 min). This turns "seems fixed" into "fixed by ≤ vX" plus "still green at latest". Find the original issue with `gh search issues --owner shader-slang <symbols from the test>`; close the argument with ancestry — `gh api repos/shader-slang/slang/compare/<fix-commit>...master --jq .behind_by` = 0 means the fix is in master, and releases at behind_by 0 extend the empirical result to ToT. Re-enabling the tests arms a nightly ci-latest-slang job as the permanent ToT guard. Verified on slangpy#940: two stale skips, both bugs fixed ≥9 months and ~19 releases earlier [Version-bracket repro for "is the compiler bug fixed?" triage asks](../learnings/1795043749961-version-bracket-repro-for-is-the-compiler-bug-fixe.md).

## Verifying slangpy test-file-only PRs at PR head without a rebuild

For test-file-only slangpy PRs (no C++/Python source changes), verify at PR head without rebuilding: the project venv is `/workspace/agent/slangpy/.venv` (system python3 has no torch — always use the venv python), and the built native ext lives inside the source tree (`slangpy/slangpy_ext.cpython-311-x86_64-linux-gnu.so`, not pip-installed) with an absolute rpath loading `libsgl.so`/`libslang-*.so` from the main checkout's build dir regardless of cwd. So: `git worktree add /workspace/agent/slangpy-pr-<n> <head>`, copy the ext `.so` into the worktree's `slangpy/`, run pytest from the worktree with the venv python — tests exercise PR-head code against the shared native build. Only valid when the PR touches no `src/` or package source; otherwise rebuild. A green run is genuinely native coverage (the venv has `slangpy-torch` installed; a missing native bridge raises loudly in `calldata.py` rather than silently falling back). Used to verify PR #1283 (48 passed, 598 deselected at head e8bcea8d on the L40S) [Verify slangpy test-file-only PRs at PR head without rebuilding (copy ext .so into a worktree)](../learnings/1795047428032-verify-slangpy-test-file-only-prs-at-pr-head-witho.md).

**Source learnings (6):**
- [`-version` hash is CMake-cache-pinned; prove HEAD via git/mtimes/`ninja -n`](../learnings/1795046111072-proving-a-slangc-build-is-at-head-when-version-sho.md)
- [default branch is `master`; `curl -sf | jq` masks fetch failure](../learnings/1795082551482-slang-repo-default-branch-is-master-not-main.md)
- [build module/gfx/dispatcher targets; stale shared clones predate harness features](../learnings/1795093206261-targeted-slang-builds-miss-all-only-standard-modul.md)
- [grep config log for "without LLVM"; `SLANG_SLANG_LLVM_BINARY_URL` has one prefix](../learnings/1795099153283-slang-build-silent-no-llvm-fallback-and-the-slang-.md)
- [bracket oldest/pin/latest + `behind_by` ancestry for "is it fixed" asks](../learnings/1795043749961-version-bracket-repro-for-is-the-compiler-bug-fixe.md)
- [worktree + ext `.so` copy verifies test-only slangpy PRs with no rebuild](../learnings/1795047428032-verify-slangpy-test-file-only-prs-at-pr-head-witho.md)

_Catalog: [[wiki/index.md]]_
