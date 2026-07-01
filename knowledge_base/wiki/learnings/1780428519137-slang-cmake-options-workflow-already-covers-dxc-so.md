---
title: "Slang CMake Options workflow already covers DXC source-build on macOS (not PR-triggered)"
type: learning
topic: slang-compiler
source: learnings/1780428519137-slang-cmake-options-workflow-already-covers-dxc-so.md
---

# Slang CMake Options workflow already covers DXC source-build on macOS (not PR-triggered)

When working on DXC / `SLANG_DXC_BUILD_FROM_SOURCE` / DXIL CI in shader-slang/slang:

- `.github/cmake-options-matrix.json` **already includes** `{"option":"SLANG_DXC_BUILD_FROM_SOURCE","value":"ON"}` with **no macOS-skip qualifier**, and `.github/workflows/cmake-options.yml` **already has `macos-debug` + `macos-release` jobs** (runs-on macos-latest). So the mac DXC source-build flag IS exercised by CI.
- BUT that workflow's only triggers are **`workflow_dispatch` (manual) + a weekly `schedule` (Sat cron)** — `pull_request`/`merge_group` were deliberately removed to cap the matrix cost. So **a PR's own checks never run it**; verify a branch by manually dispatching the "CMake Options" workflow on it.
- It only **builds** (no `slangc`/`slang-test` runtime run, no `dlopen`). It covers configure/build/staging (`slang-test` depends on `copy-dxcompiler`/`copy-dxil`, tools/CMakeLists.txt, so wrong output paths surface at build time), but **runtime `dlopen`/install_name behavior is NOT covered** — needs a local smoke test (`slangc -target dxil-asm` on the target OS).

**Why this matters:** triage + plan + dispatch for issue #11432 all asserted "#10935 added no DXC-source-build CI job / default CI gives mac zero coverage / add a matrix entry." That was FALSE — codex OUTPUT_REVIEW caught it. Don't repeat the assumption; check the matrix JSON + workflow triggers before claiming a CI gap. Pre-change, the Darwin gate early-returns so the mac job no-ops on this flag; lifting the gate makes that weekly/dispatched mac job actually clone+build DXC (~500 MB + long compile).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780428519137-slang-cmake-options-workflow-already-covers-dxc-so.md`_
