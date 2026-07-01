---
title: "slang macOS DXC-default PR: coverage-nightly coverage-macos is an un-opted-out required gate"
type: learning
topic: slang-compiler
source: learnings/1780463258746-slang-macos-dxc-default-pr-coverage-nightly-covera.md
---

# slang macOS DXC-default PR: coverage-nightly coverage-macos is an un-opted-out required gate

When reviewing the "build DXC from source by default on macOS" change (issue #11438 / PR #11439, on base adc996670):

The macOS opt-out (`-DSLANG_DXC_BUILD_FROM_SOURCE=OFF`) was added only to `.github/workflows/ci-slang-build.yml` (guarded by `inputs.os == "macos"`). That reaches PR CI (`ci.yml`, os: macos) and sccache (`populate-sccache.yml`, os: macos) — verified the define flows into `cmake_launcher_defines` → `cmake --preset default --fresh`.

But it does NOT reach the scheduled workflows that use *separate* reusable workflows:
- `cmake-options.yml` (weekly Sat cron + dispatch, NO pull_request) — has macos-debug/release AND already an explicit `SLANG_DXC_BUILD_FROM_SOURCE=ON` matrix entry, so Darwin source build is already exercised weekly there (green = evidence it works).
- `coverage-nightly.yml` (nightly) — `coverage-macos` builds with `cmake --preset coverage` (DXIL on, no opt-out) → now source-builds DXC by default (≥500MB + LLVM/Clang, 10-30 min). CRITICAL: the organize/merge job requires `needs.coverage-macos.result == 'success'`, so a Darwin source-build failure/timeout breaks nightly coverage. Coverage job disk check is only min-disk-gb: 10.

Lesson: when a CI opt-out must "cover all macOS jobs," enumerate ALL reusable-workflow callers, not just ci-slang-build.yml, and check whether any un-covered job is a REQUIRED gate (the dangerous case). The required-gate aspect turns "scheduled jobs do extra work — intended/disclosed" into "nightly can break." Any fix is itself a workflows/ file → bot can't push → must bundle into the maintainer snippet.

CMake side was clean: the new Darwin `elseif(NOT DEFINED SLANG_DXC_BUILD_FROM_SOURCE AND NOT DEFINED SLANG_DXC_BINARY_URL AND Darwin)` correctly distinguishes unset vs OFF (no option()/CACHE for the flag, so NOT DEFINED works), preserves the custom-URL escape hatch, and reuses #10935's .dylib-aware staging (CMAKE_SHARED_LIBRARY_SUFFIX). Docs/mermaid accurate (CustomUrl node handles escape hatch before the macOS node).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780463258746-slang-macos-dxc-default-pr-coverage-nightly-covera.md`_
