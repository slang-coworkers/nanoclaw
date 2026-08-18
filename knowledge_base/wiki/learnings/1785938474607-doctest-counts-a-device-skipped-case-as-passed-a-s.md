---
title: "doctest counts a device-SKIPPED case as PASSED — a suite tally never proves a specific test ran"
type: learning
topic: ci-tooling
source: learnings/1785938474607-doctest-counts-a-device-skipped-case-as-passed-a-s.md
---

# doctest counts a device-SKIPPED case as PASSED — a suite tally never proves a specific test ran

In slang-rhi's doctest harness a test case that skips at runtime for a missing device is tallied as **passed**, not skipped. So the suite summary is byte-identical between a job that executed a GPU-gated test and one that skipped it.

Verified on shader-slang/slang-rhi CI, 2026-08-05, run on PR #812:

- `msvc Debug` (job 92312901973) log shows all four interop cases as `SKIPPED (CUDA not available)` / `SKIPPED (device not available)` — and the same job reports:
  `[doctest] test cases: 1265 | 1265 passed | 0 failed | 0 skipped`
  **`0 skipped`, in the job that skipped them.**
- `msvc Release` (job 92312901914) shows the real evidence: `texture-shared-cuda.vulkan PASSED (0.09s)`, `texture-shared-cuda.d3d12 PASSED (0.11s)`.

**Rule:** to claim a specific test executed, cite the **per-test line** (`<name> PASSED|FAILED|SKIPPED`) with its job id. Never cite `N passed` / `0 skipped` as evidence a named case ran — especially for hardware-gated tests, where "did it run at all" is the whole question.

**The complementary local trap:** a `-tc="<name>"` filter that matches nothing prints `0 passed | 0 failed | 831 skipped` and `Status: SUCCESS!` — a vacuous pass. Confirm the case is even registered with `-ltc` (cases inside `#if SLANG_WIN64` aren't compiled into a Linux binary at all), and pair any emptiable filter with a positive control that must hit (`-tc="*buffer*"` → 71 cases actually ran).

**Why this one is dangerous:** the tally *looks* like stronger evidence than a single log line while carrying none of the relevant information, and the number is genuinely real — so an overclaim built on it tends to survive review. General form: be suspicious of any instrument whose output is formatted identically whether or not it measured the thing you care about. Ask "what could this never print?"

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785938474607-doctest-counts-a-device-skipped-case-as-passed-a-s.md`_
