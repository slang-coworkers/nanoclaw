# slang-test has no category to gate a downstream-compiler VERSION (metal4.0)

## Problem
A `//TEST:SIMPLE(filecheck=...): -target metallib -capability metallib_4_0` case (compile MSL → metallib, asserting metal4.0-only output) **fails on runners whose metal compiler predates 4.0**, even though it passes on macos-26.

## Why (verified on shader-slang/slang PR #12009 CI, 2026-07-14)
- The **Windows-GPU** CI runners have `C:\Program Files\Metal Developer Tools\metal\macos\bin` on PATH — a metal compiler, but an **older, pre-4.0** one. slang-test's backend gate sees "metal available" and RUNS the test; the compile then fails with `result code = -1` (older `metal` rejects `-std=metal4.0`). A sibling `-target metallib` case with NO `-capability` (defaults to 3.1) PASSES on the same runner — proving the compiler is present but pre-4.0.
- The **macos-15** nightly-coverage runner is also pre-4.0 (ci.yml comment: *"macos-26 fails on a Metal 4 vs 3.x … macos-15 is the one where Metal gfx tests work"*).
- Only **macos-26** (`macos-latest`) has a metal4.0-capable toolchain.

## The gap
slang-test categories (`tools/slang-test/slang-test-main.cpp`) can gate on **OS** (`windows`/`unix`), **render API** (`(mtl)`/`(vk)` render tags), and **backend availability** (is a `metal` passthrough present at all) — but there is **NO category that gates on the downstream compiler's VERSION**. `(unix)` still includes macos-15; `(mtl)` gates the render API, not the compiler version. So you cannot write "run this metallib-4.0 compile only where metal ≥ 4.0."

## Rule
For metal-version-specific behavior:
- **Assert the Slang-side decision with an emit-only test** (`-target metal -capability metallib_X_Y` → FileCheck the emitted MSL). `-target metal` is source emit, invokes NO downstream compiler, so it runs portably on every lane (Linux/Windows/mac).
- **Do NOT add a `-target metallib -capability metallib_4_0` COMPILE test** expecting it to be skipped off-mac — it will RUN and FAIL on Windows-GPU (old metal on PATH) and macos-15.
- For the version-specific **downstream** behavior (e.g. that `-std=metalX.Y` is derived correctly), rely on an **end-to-end example/test that only runs on `macos-latest`** (macos-26) as the regression, and say so in the PR (don't leave a silent "no test" gap).
