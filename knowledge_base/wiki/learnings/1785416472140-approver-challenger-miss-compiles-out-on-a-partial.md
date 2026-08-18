---
title: "[approver/challenger-miss] 'compiles out' on a partially-gated feature must be verified per-file/per-symbol, not asserted categorically"
type: learning
topic: review-approval
source: learnings/1785416472140-approver-challenger-miss-compiles-out-on-a-partial.md
---

# [approver/challenger-miss] "compiles out" on a partially-gated feature must be verified per-file/per-symbol, not asserted categorically

**Symptom:** On slang-rhi#803 R2 I wrote in the handoff that "the CPU ray-query implementation (src/cpu/*) is excluded from the build" and that Devin's flagged files "compile out." OUTPUT_REVIEW (codex) caught this as overbroad, and source verification proved it wrong: only ONE whole file was excluded, and one of the two Devin "bugs" sits in unconditionally-compiled code.

**Root cause:** A CMake feature toggle (`SLANG_RHI_ENABLE_CPU_RAY_QUERY`) gates a feature in a MIXED way, and I generalized from "the feature is off" to "all the feature's code is gone." Verified reality at R2 head 658c053185cf:
- Whole-file source exclusion: ONLY `src/cpu/cpu-acceleration-structure.cpp` (gated `target_sources`, CMakeLists:832). The dedicated CPU test file `tests/test-cpu-ray-query.cpp` is likewise gated (CMakeLists:1150-1152).
- Other CPU sources (`cpu-command.cpp`, `cpu-device.cpp`, `cpu-shader-object.cpp`) compile UNCONDITIONALLY (source list CMakeLists:816-822). They contain `#ifdef SLANG_RHI_ENABLE_CPU_RAY_QUERY` sections, but the guarding is per-implementation, NOT categorical:
  - `cpu-device.cpp:36` `addFeature(Feature::RayQuery)` IS inside the #ifdef → the RayQuery-not-advertised finding is mooted when the feature is off.
  - `cpu-command.cpp:336` `cmdQueryAccelerationStructureProperties` is UNCONDITIONAL → that finding compiles and runs regardless of the toggle.
- Shared CTS `tests/test-ray-query-cts.cpp` compiles unconditionally (CMakeLists:1103); only its device-mask degrades `CPU|D3D12`→`D3D12` via `#ifdef` (test-ray-query-cts.cpp:1078-1082) — CPU cases unregistered, D3D12 cases remain compiled+registered.

**How to catch it:** When arguing a finding is "CI-invisible because the feature compiles out," do NOT reason from the toggle alone. (1) Check whether the file is excluded as a whole source (`target_sources` inside the `if(FEATURE)`) vs merely compiled with internal `#ifdef`s — `grep -n <file> CMakeLists.txt`. (2) For a file that compiles unconditionally, open the specific flagged line and confirm whether IT is inside the `#ifdef` — count is not enough (cpu-device.cpp had 4 macro occurrences but the flagged symbol was gated; cpu-command.cpp had 3 but the flagged symbol was not). (3) "The D3D12 cases would run" is a separate unproven claim — code being compiled+registered ≠ executed; state "remain compiled and registered," not "would exercise," unless you've confirmed the CI device runs them. (4) Devin/CodeRabbit line-cites can be off by ~20 lines (Devin cited test-ray-query-cts.cpp:999-1002 for a REQUIRE actually near 1023) — verify the exact site before repeating a citation.

**Fix:** Split the CI-visibility claim per-symbol in the handoff: gated-and-mooted (cpu-device.cpp:36), whole-file-excluded (cpu-acceleration-structure.cpp), vs unconditional-so-still-live (cpu-command.cpp:336). Doesn't change the decision (size-cap ABSTAIN short-circuits), but it prevents handing a human maintainer a subtly false "don't worry, it all compiles out" premise that could cause them to dismiss a live finding.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785416472140-approver-challenger-miss-compiles-out-on-a-partial.md`_
