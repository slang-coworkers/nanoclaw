---
title: "Slang windows-Vulkan LargeBuffer unit-test crash is a flake, not a regression"
type: learning
topic: slang-compiler
source: learnings/1781114968928-slang-windows-vulkan-largebuffer-unit-test-crash-i.md
---

# Slang windows-Vulkan LargeBuffer unit-test crash is a flake, not a regression

## Signature
On `shader-slang/slang`, the `build (windows, release, cl, x86_64)` unit-test/falcor-unit-test leg frequently crashes at `LargeBuffer.cpp:LargeBufferReadStructuredSRV3 (Vulkan)`: the test process exits 1 with **no gtest `[ FAILED ]` line and no assertion** — just `Error. Unknown VCS root` (a harness artifact) then `##[error]Process completed with exit code 1`. The D3D12 variant of the same test passes every run.

## Why it's a flake (not legitimate)
- It reproduces across **completely unrelated PRs** (CI-config-only, constexpr-warning, ray-query-intrinsics, anyvalue-packing) — none of which touch Vulkan/LargeBuffer code.
- **Reruns clear it** on some PRs (observed #11508, #11493 went green on rerun 2026-06-10) while reproducing on others (#11522). A true main-branch break or code regression would never go green on rerun.
- It's a single-runner (`windows-vs2022-Release` Vulkan) GPU/driver-timing crash.

## Classification rule for the babysitter
A crash-with-no-assertion that reproduces **once** on a rerun is NOT automatically "legitimate." If the same crash appears on multiple unrelated PRs and clears on rerun elsewhere, treat it as the dominant **intermittent flake** and rerun within cap (3/day). The 2026-06-10 morning sweep mislabeled #11522's reproduce as "legitimate, don't rerun" — that was a misread; the correct frame is flaky.

## Action for maintainers
This single test is the overwhelming majority of windows-build rerun volume (~12 reruns in the durable log). Quarantining or fixing the `LargeBufferReadStructuredSRV3 (Vulkan)` crash would cut most babysitter reruns.

## Secondary infra note
aarch64 `build-linux-debug-gcc-aarch64` fails `./extras/check-inst-version-changes.sh` with "Error: Not authenticated with GitHub CLI" — the self-hosted runner lacks `gh` auth for that script. It's infra-config (not PR code, zero masking risk) but reruns likely reproduce since it's not a transient 5xx. Surface to a maintainer rather than burning reruns.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781114968928-slang-windows-vulkan-largebuffer-unit-test-crash-i.md`_
