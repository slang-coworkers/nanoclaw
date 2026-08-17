---
title: "slang-rhi macOS CI: a green macOS job does NOT mean Metal was tested"
type: learning
topic: slang-compiler
source: learnings/1785756797105-slang-rhi-macos-ci-a-green-macos-job-does-not-mean.md
---

# slang-rhi macOS CI: a green macOS job does NOT mean Metal was tested

## The trap

A green `build (macos, aarch64, clang, *)` job in **shader-slang/slang-rhi** CI proves only that the Metal translation units **compiled**. It does *not* mean any Metal test ran. `slang-rhi-tests -check-devices` reports unsupported devices and **exits 0**, so an entirely-skipped Metal backend looks identical to a passing one.

Verified on run 30804222761 / job 91655709489 (2026-08-03), where the log said:

```
Metal: not supported (failed to get shader entry point code)
Slang diagnostics: metal 32023.883: error : 'required_threads_per_threadgroup' attribute
  requires Metal language standard metal4.0 or higher
```

…while the job itself reported **success**. Every Metal test silently skipped.

## Root cause (tracked as shader-slang/slang#12096, open, assignee jkwak-work)

1. `macos-latest` now resolves to the **`macos-26-arm64`** image (check the log's `Image:` line — don't assume macOS 15).
2. slang-rhi derives the capability from the **OS version**: `if (osVersion.majorVersion >= 26) addCapability(Capability::metallib_4_0);` (`src/metal/metal-device.cpp`, `main`:266).
3. Slang's emit gate `getTargetCaps().implies(CapabilityAtom::metallib_4_0)` (`slang-emit-metal.cpp`, `emitRequiredThreadsPerThreadgroup`) then emits `[[required_threads_per_threadgroup(...)]]`.
4. But the image's Metal toolchain is Xcode-16-era (`metal 32023.883`) and rejects the 4.0-only attribute → shader compile fails → the whole Metal device is reported unsupported.

The OS version and the actual Metal toolchain **disagree** on these images. Per #12096 the fix belongs in slang-rhi: derive `metallib_4_0` from the Metal toolchain/language version available at runtime, not from the OS version. Related: #12075 pins the nightly coverage workflow to `macos-15` as a workaround. Upstream, `metallib_latest = metallib_4_0` (`slang-capabilities.capdef`:212) plus the hardcoded `-std=metal3.1` fallback (`slang-gcc-compiler-util.cpp`:987) are the same axis.

## How to apply

- **Never claim a Metal path is "covered by macOS CI" from a green checkmark.** Open the job log and grep for `Metal: not supported` / `Metal: supported` in the `-check-devices` output.
- If you're shipping a Metal-only feature, say explicitly that runtime coverage is *pending* while #12096 is open — the tests are being skipped, not passed.
- Same caution for the `Vulkan: not supported (failed to create device)` line on macOS runners.

## Bonus: the same job log tells you the residency mode

That job also logged `GPUFamilyApple6 not supported; using per-encoder useResource fallback`, i.e. the hosted macOS runner is on Metal's **`!m_hasResidencySet` fallback** residency path, not the residency-set path. If a feature behaves differently between those two modes (e.g. anything relying on implicit residency), the hosted runner exercises the *fallback*, which is often the less-common configuration in the field. Don't assume CI represents typical Apple-Silicon hardware.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785756797105-slang-rhi-macos-ci-a-green-macos-job-does-not-mean.md`_
