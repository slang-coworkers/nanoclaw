---
title: "Slang CI: how GPU-requiring unit tests are silenced on no-GPU / aarch64 runners"
type: learning
topic: ci-tooling
source: learnings/1780769170873-slang-ci-how-gpu-requiring-unit-tests-are-silenced.md
---

# Slang CI: how GPU-requiring unit tests are silenced on no-GPU / aarch64 runners

From triaging shader-slang/slang#11500 (master @ 5230a81f2). Reusable for any "a GPU test is failing/silenced on a hosted CI runner" triage.

**Layered expected-failure lists (`.github/workflows/ci-slang-test.yml`):** slang-test takes multiple cumulative `-expected-failure-list` flags. The workflow layers them by job class:
- always: `tests/expected-failure-github.txt` (line ~106)
- when `full-gpu-tests != true`: + `tests/expected-failure-no-gpu.txt` (lines ~133-135)
- Linux jobs: + `tests/expected-failure-linux.txt` (lines ~138-140)
- T4 GPU tier: + `tests/expected-failure-linux-gpu.txt`

**aarch64 Linux runners are the no-GPU class.** `.github/workflows/ci.yml` (~238-262): `test-linux-{debug,release}-gcc-aarch64` use `runs-on: ubuntu-24.04-arm`, `full-gpu-tests: false` → they already consume `expected-failure-no-gpu.txt`. (macOS aarch64 is `full-gpu-tests: true` — Metal works there, so it does NOT take the no-gpu list.)

**Established convention:** Vulkan/CUDA `gfx-unit-test-tool/*` tests that need a real GPU go in `tests/expected-failure-no-gpu.txt` under the `# Vulkan gfx-unit-tests require a Vulkan-capable GPU` block (~24 entries at HEAD). So the right home for a newly-failing Vulkan unit test on a no-GPU runner is almost always this existing file — not a new platform-specific list.

**Non-obvious gotcha:** `tools/gfx-unit-test/gfx-test-util.cpp:265-269` already does `SLANG_IGNORE_TEST` when `getRHI()->createDevice()` fails (e.g. `vkCreateInstance` returns `SLANG_FAIL` at `tools/gfx/vulkan/vk-device.cpp:297-309`). Yet ~24 Vulkan tests are STILL listed in `expected-failure-no-gpu.txt` — meaning the auto-skip is insufficient for some failure modes (likely: loader present but no ICD → instance creates, `vkEnumeratePhysicalDevices` returns 0 → failure past the skip point). Don't assume "it has SLANG_IGNORE_TEST so it'll skip"; the expected-failure list is the reliable belt-and-suspenders.

**Verification gate that distinguishes "no-GPU" from "platform-specific" failure:** if a test is green on the x86_64 hosted no-GPU job (e.g. `sanitizer-linux-clang-x86_64`, `-api all`) but fails on aarch64, the cause is the aarch64 runner's Vulkan environment, not the generic no-GPU condition — and filing it under `expected-failure-no-gpu.txt` is slightly over-broad (harmless no-op on x86_64). Clean alternative for aarch64-only Vulkan exclusion: `-api all -api -vk` on the aarch64 invocation (operator-leading accumulation is valid per PR #11497's `tools/slang-test/options.cpp` parsing fix).

**`-category` removal context:** PR #11497 dropped `-category` from CI so aarch64 runs the `full` suite (default) instead of `smoke`; that's what newly exposed these GPU unit tests on aarch64. `-category` and `-api` are flagged "avoid" in CLAUDE.md for local use but CI still uses them.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780769170873-slang-ci-how-gpu-requiring-unit-tests-are-silenced.md`_
