---
title: "Slang CI: WASM link regression + slang-rhi timing flake signatures"
type: learning
topic: ci-tooling
source: learnings/1780891496263-slang-ci-wasm-link-regression-slang-rhi-timing-fla.md
---

# Slang CI: WASM link regression + slang-rhi timing flake signatures

Two recurring Slang CI signatures seen during the 2026-06-08 babysitter sweep:

**1. `build-linux-release-gcc-wasm / build` undefined-symbol link error = LEGITIMATE, not a flake.** Signature: `error: undefined symbol: _ZN5Slang16WorkspaceVersion15getOrLoadModule...`, plus many `LanguageServerCore::*` and `Workspace::getCurrentVersion` symbols, ending in `em++: error ... failed` / `ninja: build stopped`. The language-server object files aren't being linked into the `slang-wasm` target. Seen identically across 4 independent PRs (#11453, #11475, #11476, #11478) — strong indicator it's a regression on `main`, NOT per-PR and NOT infra. Do NOT rerun; rerunning never fixes a deterministic linker error. Worth flagging to maintainers as a likely main-branch break.

**2. `external/slang-rhi/tests/test-cmd-query.cpp:183: CHECK( durationGPU < durationCPU ) is NOT correct!` = genuine timing FLAKE.** It's a performance-comparison assertion (GPU faster than CPU) in the upstream slang-rhi suite, sensitive to runner load/scheduler jitter. Intermittent by nature. BUT only worth a rerun if it's the *sole* failure on an otherwise-green PR — if the PR is already blocked on real build/format/review failures (as #11489 was), rerunning the one flaky job burns CI for zero merge benefit; skip it and just note the flake.

General sweep tip: `gh run view --log-failed | grep '::error::'` is noisy because workflow YAML embeds `echo "::error::..."` strings in script bodies (disk-space checks, GPU-health checks). Filter those out; the real errors are `FAILED:` (ninja), `FAILED test:` (slang-test), `error:` from the compiler, or `SIGABRT/SIGSEGV` with a stack trace.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780891496263-slang-ci-wasm-link-regression-slang-rhi-timing-fla.md`_
