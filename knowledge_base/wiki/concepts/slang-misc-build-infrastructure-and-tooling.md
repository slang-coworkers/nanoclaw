---
title: "Slang Build Infrastructure, Tooling, and Language Server"
type: concept
group: slang-grab-bag
tags: [build, CMake, MSVC, slangd, LSP, language-server, build-tag, version, downstream-compilers, NVRTC, VK_KHR_shader_abort, SPIR-V, IRTextureType, imgui, dev-shm, coworker-container]
source_count: 18
---

# Slang Build Infrastructure, Tooling, and Language Server

This page covers build system mechanics (CMake, version tags, system dependencies), downstream compiler API surface, language server (slangd) configuration, MSVC quirks, container build environment, and SPIR-V extension implementation patterns.

## Build Tag and Version String

`spGetBuildTagString()` returns the Slang library/release version via `git describe`. A clean version string (no `-N-gSHA` suffix) indicates the binary was built exactly at that tag. This is useful for diagnosing version mismatches in distribution channels ([Slang build tag = git-describe release version; clean string means built exactly at that tag](wiki/learnings/1781381821358-slang-build-tag-git-describe-release-version-clean.md)).

## SLANG_USE_SYSTEM_* CMake Options

There are 7 `SLANG_USE_SYSTEM_*` CMake options; none use Slang-defined `_ROOT_DIR` variables — they all delegate to standard `find_package`. The tree has three separate dependency-locating conventions: `USE_SYSTEM`, `Find*.cmake` hand-written modules, and `SLANG_OVERRIDE_*_PATH` ([Slang SLANG_USE_SYSTEM_* options: all find_package, no _ROOT_DIR; three separate dep-locating conventions](wiki/learnings/1782762110953-slang-slang-use-system-options-all-find-package-no.md)).

## MSVC 14.51 C5285 on vendored doctest

MSVC 14.51 (May 2026) emits `C5285` on doctest's forward-declarations of `std::tuple`, which becomes an error under `/WX`. The fix is a targeted `/wd5285` suppression on the `slang-rhi-tests` target, or defining `DOCTEST_CONFIG_USE_STD_HEADERS`. Bumping vendored doctest to v2.6 does not work yet (unreleased) ([MSVC 14.51 C5285 on vendored doctest (std::tuple) — slang-rhi](wiki/learnings/1781056535440-msvc-14-51-c5285-on-vendored-doctest-std-tuple-sla.md), [slang-rhi: MSVC 14.51 C5285 on doctest fixed by /wd5285 scoped to test target](wiki/learnings/1781056304699-slang-rhi-msvc-14-51-c5285-on-doctest-fixed-by-wd5.md)).

## imgui Unity Build

imgui is consumed as a unity build in slang's `tools/platform/gui.cpp`. Bumping the submodule needs no CMake changes but requires `#define IMGUI_DEFINE_MATH_OPERATORS` before the first imgui include. Major API changes from v1.68 to v1.92.8 apply ([imgui in slang is a unity build; bumping it needs IMGUI_DEFINE_MATH_OPERATORS](wiki/learnings/1782235481283-imgui-in-slang-is-a-unity-build-bumping-it-needs-i.md)).

## Coworker Container: /dev/shm Is Only 64MB

The slang coworker container has only 64MB of `/dev/shm` tmpfs. Parallel C++ builds cause SIGBUS in `cc1plus` from tmpfs exhaustion. Fix: set `TMPDIR` to an on-disk path and reduce build parallelism ([slang coworker /dev/shm is 64M — parallel C++ builds SIGBUS in cc1plus; set TMPDIR on disk](wiki/learnings/1781716025205-slang-coworker-dev-shm-is-64m-parallel-c-builds-si.md)).

## Downstream Compilers: Version Discovery

The loaded downstream compiler version (e.g. NVRTC major/minor) is already captured in `m_desc.version` via `getDesc()` on `IDownstreamCompiler`. A new public API to expose it should reuse `Session::getOrLoadDownstreamCompiler` and append a new virtual to `IGlobalSession` at the end of the vtable to remain non-breaking ([Slang already captures the loaded downstream-compiler version — exposing it is a thin read](wiki/learnings/1781171365104-slang-already-captures-the-loaded-downstream-compi.md)).

Only DXC, glslang, and tint override `IDownstreamCompiler::getVersionString`. NVRTC falls through to the base which returns `SLANG_FAIL` and sets `*outVersionString = nullptr`. A public API returning NVRTC version must use the numeric `getDesc().version` path ([NVRTC downstream compiler has no getVersionString override — use getDesc().version](wiki/learnings/1781172987354-nvrtc-downstream-compiler-has-no-getversionstring-.md)).

## IRTextureType Format Operand

`IRTextureType`'s `format` operand is **optional** (requires `hasFormat()` guard; operand 8 only present when ≥9 operands). Synthesized format constants must use `getIntType()` not `getUIntType()` because the hoistable-type cache keys on the integer constant's type token — mismatched types prevent deduplication and can cause SIGSEGV ([IRTextureType format-operand: optional, and int-vs-uint matters for hoistable dedup (slang#11496/#11499)](wiki/learnings/1780769319751-irtexturetype-format-operand-optional-and-int-vs-u.md)).

`resolveTextureFormatForParameter` at `slang-ir-resolve-texture-format.cpp:54` is the only in-tree producer that synthesizes a fresh `format` constant; it must use `getIntType()` to match the schema (`hlsl.meta.slang:832 let format:int`). All format-operand readers are type-token-agnostic so this is a non-breaking foreclosure fix ([Slang IRTextureType format-operand: int vs uint encoding + only-fresh-producer site (slang#11503)](wiki/learnings/1780769345401-slang-irtexturetype-format-operand-int-vs-uint-enc.md)).

Prophylactic bug validation requires three checks: any present-day producer emits the colliding value, readers are sensitive to the drifting property, and the colliding producer is actually in master (not just an unmerged branch) ([Adjudicating latent prophylactic schema-drift claims (Slang IRTextureType format operand, #11503)](wiki/learnings/1780769176028-adjudicating-latent-prophylactic-schema-drift-clai.md)).

## VK_KHR_shader_abort Implementation

`VK_KHR_shader_abort` follows the printf model for the frontend but differs crucially in SPIR-V emit: `OpAbortKHR` (opcode 5121) is a **Control-Flow terminator** taking a struct type + value, not a value-producing `OpExtInst`. Both the enum and capability are already vendored in spirv-headers so no submodule bump is needed ([slang VK_KHR_shader_abort is printf-frontend but a core OpAbortKHR, not an OpExtInst](wiki/learnings/1781038945892-slang-vk-khr-shader-abort-is-printf-frontend-but-a.md)). Adding it follows the printf model (capdef atoms, IR opcode, per-target emit) but differs in that `OpAbortKHR` requires `OpTypeStruct` + `OpCompositeConstruct` for its message; there is a naming collision with the existing HLSL SM4 `abort()` builtin requiring a design decision ([Slang: implementing VK_KHR_shader_abort (OpAbortKHR) — printf-parallel but it's a terminator](wiki/learnings/1781072417779-slang-implementing-vk-khr-shader-abort-opabortkhr-.md)).

## DescriptorHandle: Two Lowering Models

`DescriptorHandle<RaytracingAccelerationStructure>` has two incompatible lowering models: **plain bindless** (handle = 64-bit GPU device address → `OpConvertUToAccelerationStructureKHR`) vs **heap-indexed** (`spvDescriptorHeapEXT`, handle = heap index) ([Slang DescriptorHandle<AccelerationStructure>: two models, heap vs plain bindless](wiki/learnings/1781903775019-slang-descriptorhandle-accelerationstructure-two-m.md)).

`DescriptorHandle<ConstantBuffer<T>>` wouldn't implicitly convert to `ConstantBuffer<T>` because a blanket guard in `_coerce` rejecting any `ParameterGroupType` target runs before constructor-based conversion search. Maintainer preferred full removal of the dubious guard since regression testing proved it non-load-bearing ([slang DescriptorHandle<T> → T implicit conversion blocked for ParameterGroupType targets by _coerce guard ordering](wiki/learnings/1782151554268-slang-descriptorhandle-t-t-implicit-conversion-blo.md)).

## slangd Config Settings: Two-Repo Job

Adding a VSCode-configurable slangd setting requires changes in **both** the slang repo (server-side config request + dispatch + application in `SessionDesc`) and the `slang-vscode-extension` repo (`package.json` declaration). Copy the `workspaceFlavor` template ([Adding a slangd config setting is a two-repo job — copy the workspaceFlavor template](wiki/learnings/1781797125582-adding-a-slangd-config-setting-is-a-two-repo-job-c.md)).

Slangd config settings cannot be verified with slang-test. Require an LSP stdio probe that **responds** to the server's `workspace/configuration` pull. Notes on per-setting application differences and mid-session refresh patterns ([Verifying slangd LSP-config settings: probe must answer the workspace/configuration pull](wiki/learnings/1782172056258-verifying-slangd-lsp-config-settings-probe-must-an.md)).

## slang-rhi Submodule Pin Lag

When verifying claims about `external/slang-rhi/` behavior, the pinned submodule in the slang repo may lag behind active feature work. A design/tracking issue authored by the feature developer often describes the world as it will be once their open PR lands ([Verifying slang-rhi claims at slang HEAD: the submodule pin lags in-flight feature PRs](wiki/learnings/1781118704722-verifying-slang-rhi-claims-at-slang-head-the-submo.md)).

---
**Source learnings (23):**
- [MSVC C5285 on doctest fixed by /wd5285](wiki/learnings/1781056304699-slang-rhi-msvc-14-51-c5285-on-doctest-fixed-by-wd5.md)
- [MSVC 14.51 C5285 on vendored doctest](wiki/learnings/1781056535440-msvc-14-51-c5285-on-vendored-doctest-std-tuple-sla.md)
- [slang-rhi submodule pin lags feature PRs](wiki/learnings/1781118704722-verifying-slang-rhi-claims-at-slang-head-the-submo.md)
- [Slang captures downstream compiler version](wiki/learnings/1781171365104-slang-already-captures-the-loaded-downstream-compi.md)
- [NVRTC has no getVersionString override](wiki/learnings/1781172987354-nvrtc-downstream-compiler-has-no-getversionstring-.md)
- [build tag = git-describe version](wiki/learnings/1781381821358-slang-build-tag-git-describe-release-version-clean.md)
- [/dev/shm is 64M, parallel builds SIGBUS](wiki/learnings/1781716025205-slang-coworker-dev-shm-is-64m-parallel-c-builds-si.md)
- [adding slangd config is two-repo job](wiki/learnings/1781797125582-adding-a-slangd-config-setting-is-a-two-repo-job-c.md)
- [DescriptorHandle AccelerationStructure two models](wiki/learnings/1781903775019-slang-descriptorhandle-accelerationstructure-two-m.md)
- [DescriptorHandle<T>→T implicit conversion blocked](wiki/learnings/1782151554268-slang-descriptorhandle-t-t-implicit-conversion-blo.md)
- [verifying slangd config settings probe](wiki/learnings/1782172056258-verifying-slangd-lsp-config-settings-probe-must-an.md)
- [imgui unity build bump needs define](wiki/learnings/1782235481283-imgui-in-slang-is-a-unity-build-bumping-it-needs-i.md)
- [SLANG_USE_SYSTEM_* options all find_package](wiki/learnings/1782762110953-slang-slang-use-system-options-all-find-package-no.md)
- [adjudicating latent schema-drift claims](wiki/learnings/1780769176028-adjudicating-latent-prophylactic-schema-drift-clai.md)
- [IRTextureType format operand optional int vs uint](wiki/learnings/1780769319751-irtexturetype-format-operand-optional-and-int-vs-u.md)
- [IRTextureType format operand int vs uint encoding](wiki/learnings/1780769345401-slang-irtexturetype-format-operand-int-vs-uint-enc.md)
- [VK_KHR_shader_abort is printf frontend but terminator](wiki/learnings/1781038945892-slang-vk-khr-shader-abort-is-printf-frontend-but-a.md)
- [implementing VK_KHR_shader_abort OpAbortKHR](wiki/learnings/1781072417779-slang-implementing-vk-khr-shader-abort-opabortkhr-.md)
_Catalog: [[wiki/index.md]]_
