---
title: "[approver/challenger] slang-rhi Metal tests SKIP on GitHub-hosted macos-latest — green CI never executes the Metal path"
type: learning
topic: slang-compiler
source: learnings/1785193552208-approver-challenger-slang-rhi-metal-tests-skip-on-.md
---

# [approver/challenger] slang-rhi Metal tests SKIP on GitHub-hosted macos-latest — green CI never executes the Metal path

**Class:** slang-rhi Metal-only-feature PRs (bindless, native-buffer-import, indirect-dispatch — #800, #801, #802, sibling slang#12142). Recurring OPEN_GAP.

**Symptom:** A Metal-only-feature PR correctly extends its `GPU_TEST_CASE(...)` mask to include `Metal` (e.g. `bindless-buffers` `D3D12|Vulkan` → `+Metal`), combined status is `success`, and the macOS aarch64 CI leg (`macos-latest`, `flags: unit-test` → `./slang-rhi-tests -check-devices`) passes green. It *looks* like the Metal runtime path was verified on hardware. It was NOT.

**Root cause (empirically confirmed on rhi#802 @993c968e, 2026-07-27):** The GitHub-hosted `macos-latest` runner exposes only an **"Apple Paravirtual device"** with a non-functional Metal implementation. The CI job log shows:
```
Metal: not supported (failed to get shader entry point code)
[Driver] GPUFamilyApple6 not supported; using per-encoder useResource fallback
Adapter Name: Apple Paravirtual device
bindless-buffers.metal   SKIPPED (device not available)
bindless-textures.metal  SKIPPED (device not available)
```
The paravirtual device can't compile `metal4.0` shaders and reports Metal unsupported, so `GPU_TEST_CASE` registers the `.metal` cases but they all resolve to **SKIPPED (device not available)** at runtime. `checkNoSilentGpuSkips()` does not fail on a device that reports itself unavailable. Green status = "the mask compiles + the non-Metal cases ran," NOT "the Metal cases executed."

The slang-rhi CI matrix (`.github/workflows/ci.yml`) runs real hardware on **self-hosted `nvrgfx-kernelvm-bridge` labels for Windows/Linux only**; macOS legs run on GitHub-hosted `macos-latest`, which has no real GPU. So for slang-rhi, a Metal-only feature currently has **no CI runner that can execute it** — Vulkan on macOS also fails to create a device on that runner.

**How to catch it:** For any slang-rhi Metal-only-feature PR, do NOT stop at "mask extended + status green." Pull the macOS `build (macos, aarch64, ...)` job log (`gh api repos/<r>/actions/jobs/<id>/logs`) and grep the `-check-devices` section for the feature's `.metal` test lines. If they read `SKIPPED (device not available)` (and the header shows `Adapter Name: Apple Paravirtual device` / `Metal: not supported`), the runtime path has **zero execution coverage** → OPEN_GAP. The `CI-substitutes-for-a-timed-out-Devin` escape requires the tests to have EXECUTED and PASSED — a SKIP is not a pass.

**Fix (decision):** ABSTAIN_POLICY(OPEN_GAP). Source-verified-correct implementation does NOT round the execution gap up to approve. A human/operator must verify on real Apple-Silicon hardware. This is the operative reason siblings #800/#801/#802 all held.

**Bonus check:** also confirm every implemented Metal accessor has a *reachable* test. On #802, `SamplerImpl::getDescriptorHandle` is implemented but the only sampler-exercising case is `bindless-combined-texture-samplers`, which correctly excludes Metal (128b>uint64) — so the Metal sampler handle path has no test at all, independent of the SKIP problem.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785193552208-approver-challenger-slang-rhi-metal-tests-skip-on-.md`_
