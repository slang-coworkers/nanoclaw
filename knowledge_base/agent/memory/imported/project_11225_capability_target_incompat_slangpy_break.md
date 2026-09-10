---
name: project_11225_capability_target_incompat_slangpy_break
type: project
title: "slang PR #11225 — capability incompatible with target (slangpy hlsl_nvapi break)"
description: "slang PR #11225 (E36121 capability-incompatible-with-target, zangold-nv, fixes #4422) was blocked ONLY by a cross-repo `SlangPy Tests` red — 28x 'hlsl_nvapi incompatible with spirv'. A real, intended break (not a flake); root cause and fix were both downstream in slangpy."
source: "migrated native-memory; origin session main-2026-08-03; filed from slang-ci-babysitter sweep"
---

## Outcome (terminal, maintainer-owned)

The coworker chain (babysitter → slangpy-triager → slangpy-fixer → slangpy-reviewer) diagnosed the break, filed slangpy#1087, and landed the guard as slangpy PR #1088 (`dev/slangpy-fixer/1087`, one hunk in `src/sgl/device/shader.cpp`, `+8/−5`, `Fixes #1087`). PR #1088 was **maintainer-approved (`skallweitNV`, MEMBER) + CI green (13 success / 1 skipped / 0 fail) + merged**. slang#11225 itself was maintainer-owned at close: `mergeable_state=blocked`, zero human approvals, `bmillsNV` still requested. The fix was verified against affected Slang (see A/B below); everything else — promoting out of draft, the merge-order call, D3D12 CI for the true branch, broader `descriptor_handle` coverage — was maintainer-owned, not a coworker gate.

## Failure signature

`error[E36121]: requested capability 'hlsl_nvapi' is incompatible with compilation target 'spirv'` ×28, identical on linux-gcc AND windows-msvc, on both run attempts. `sgl_tests` 172 pass / 28 fail / 3 skip, but **0 of 18535 assertions failed** — every failure is a thrown `Failed to load slang module "test" from source`. The Slang C++ build was fully green. **Deterministic ⇒ legitimate, not rerunnable — the change works as designed.** Ruled out as flakes: fiddle/GCC-PCH break, Windows setup-python toolcache, sgl_tests teardown, CUDA-OOM, test_nested.

## Root cause (downstream, in slangpy)

`src/sgl/device/shader.cpp`:
- **L404-408 (unconditional):** `session_options.add(CompilerOptionName::Capability, findCapability("hlsl_nvapi"))`, with an adjacent TODO noting that passing all detected capabilities "leads to slang compilation errors."
- **L250 / L656 (guarded):** the actual NVAPI module create + link are gated `if (SGL_HAS_NVAPI && m_device->type() == DeviceType::d3d12)`.

So the capability request was broader than the module link it exists to support. Under #11225 (which adds the E36121 diagnostic) that unconditional request became a hard error for every non-HLSL target (spirv/vulkan, and by implication metal/cuda/wgsl). This is a real cross-repo break, not a flake. slang#11225's own diff introduces the E36121 string (`slang-diagnostics.lua` +7/−1, `slang-target.cpp` +79/−3), so `strings <binary> | grep -c` is a direct test that a build contains the change.

## Fix

**Approach A (chosen):** wrap `shader.cpp:404-408` in `if (SGL_HAS_NVAPI && device_type == DeviceType::d3d12)` — the same predicate as the module-link sites (`:250`, `:660`) and the `SGL_ENABLE_NVAPI` define (`:507-510`), so the fix is *consistency*, not novelty. Rejected: B = target-format conditional (`format == SLANG_DXIL`; semantically honest but diverges from existing sites, needs a code move); C = act on the TODO / full capability audit (unbounded, do not bundle).

Sufficiency of a single-site fix was proven by enumeration: `grep | sort | uniq -c` over both job logs returned exactly **one** distinct (capability, target) pair — `hlsl_nvapi`→`spirv`, 28× — nothing else. Reviewer added the semantic leg: #11225's `checkCapabilities()` iterates `getArray(CompilerOptionName::Capability)`, so E36121 fires only for **explicitly requested** capabilities, not in-source `[__requiresNVAPI]` attributes (e.g. `atomics.slang:57`).

## Sequencing — guard is a PREREQUISITE, not a follow-up

The initial "landed alongside #11225" framing had the ordering wrong. `slangpy/.github/workflows/ci-latest-slang.yml`'s `build-pr` checks out slangpy at its **default branch** (no `ref:`), so `SlangPy Tests` cannot go green until the guard is **merged to slangpy `main`**.
- **Stage 1 (safe now, pin-independent):** the guard itself. `external/CMakeLists.txt:85` pins `SGL_SLANG_VERSION "2026.12"` (pre-#11225) and downloads a release tarball, so the guard is a green no-op today and lands independently.
- **Stage 2 (two gates out):** the `SGL_SLANG_VERSION` bump. Chain = **#11225 merged → next release tag cut → bump.** #11225 is in no tag *because it isn't merged* — separate PR.

## Fix verification (A/B)

Against a local Slang built from `pull/11225/head` (`v2026.14.1-24-gdb61cec`) via `SGL_LOCAL_SLANG=ON`: **28× E36121 without the guard → 0 with it** (delta exactly 28; `33 = 28 + 5` closes against 5 LFS-pointer environmental failures). Three `slangc` arms isolate causation. Provenance control (the model to reuse — do NOT infer from a version string): `strings … | grep -c 'is incompatible with compilation target'` = **2** on the source-built `libslang.so` vs **0** on the downloaded `slang-2026.14.1` release, proving the diagnostic is compiled into the library under test. The `true` arm (guard KEEPS the request) was closed by Windows CI: `SGL_HAS_NVAPI: ON` + `SGL_HAS_D3D12: ON`, 200/200 cases, zero E36121, with `testing.cpp:72-83` iterating `{d3d12, vulkan}` per-SUBCASE. **Bound published, not hidden:** on Linux `SGL_HAS_NVAPI` expands to literal `0`, so the predicate short-circuits — the local A/B validates the *mechanism*, not the *choice of predicate*.

## Session theme — the one transferable control

Across the chain, multiple tiers repeatedly accepted **a signal that cannot distinguish the states it is being used to distinguish**. Instances: a vacuous grep (matched whether or not the condition held — doctest's `DEEPEST SUBCASE` header form, worsened by CRLF defeating `$`-anchors); a release artifact that merely *looks* newer than the pinned tag while being on the wrong side of an unmerged change; a stale symlink monitor; `--depth 1` masking a fetch failure; and an escalation whose presupposition (a draft PR that did not yet exist) had already been disproved.

**Control: provenance AND method are two SEPARATE checks.** Confirming where a signal came from says nothing about whether it could have come out differently. Before treating any check as evidence, ask: *if the claim were false, would this output differ?* If no, it is not evidence regardless of source. Pair every absence/zero-count claim with a positive control; check line endings before `$`-anchoring; and re-derive load-bearing digest claims from primary source — re-deriving is necessary but not sufficient if the derivation itself cannot fail. This applies to one's own reasoning as much as to relayed reports.
