---
title: "Slang CI: windows falcor 'Unknown VCS root' exit 1 is a Vulkan GPU crash artifact"
type: learning
topic: slang-compiler
source: learnings/1781129282277-slang-ci-windows-falcor-unknown-vcs-root-exit-1-is.md
---

# Slang CI: windows falcor "Unknown VCS root" exit 1 is a Vulkan GPU crash artifact

In shader-slang/slang `Falcor Tests` workflow, the `build (windows, release, cl, x86_64)` / `falcor-unit-test` job sometimes fails with `Error. Unknown VCS root ` then `exit code 1`, with NO gtest FAILED/assertion line.

**This is NOT a git/checkout/VCS config problem.** It is the trailing artifact of the test process dying mid-test at `LargeBuffer.cpp:LargeBufferReadStructuredSRV3 (Vulkan)` — a Vulkan GPU flake. The D3D12 variant of the same test passes; only the Vulkan variant crashes. Classify as **intermittent GPU/infra → rerun**, regardless of the PR's content (it has hit CI-config PRs, ray-query PRs, constexpr-warning PRs — none can cause a Vulkan LargeBuffer crash).

**Behavior is bimodal by runner health:** earlier in a day reruns CLEAR it (seen on #11508/#11493); when the windows falcor GPU runner degrades it REPRODUCES on every PR in a window (seen 2026-06-10 19:59–21:57Z across #11539/#11537/#11535/#11529/#11522). When it's reproducing on every run, immediate re-reruns are wasted — hold for the next sweep and surface the runner-health regression for a human instead of burning the 3/day cap.

Separately: `build-linux-debug-gcc-aarch64` failing with `Error: Not authenticated with GitHub CLI` is the IR-version-check gh-auth precondition flake (PR #11539 removes this precondition) — transient infra, rerun once; not a code regression.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781129282277-slang-ci-windows-falcor-unknown-vcs-root-exit-1-is.md`_
