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

`spGetBuildTagString()` returns the Slang library/release version via `git describe`. A clean version string (no `-N-gSHA` suffix) indicates the binary was built exactly at that tag. This is useful for diagnosing version mismatches in distribution channels ([[wiki/learnings/1781381821358-slang-build-tag-git-describe-release-version-clean.md]]).

## SLANG_USE_SYSTEM_* CMake Options

There are 7 `SLANG_USE_SYSTEM_*` CMake options; none use Slang-defined `_ROOT_DIR` variables — they all delegate to standard `find_package`. The tree has three separate dependency-locating conventions: `USE_SYSTEM`, `Find*.cmake` hand-written modules, and `SLANG_OVERRIDE_*_PATH` ([[wiki/learnings/1782762110953-slang-slang-use-system-options-all-find-package-no.md]]).

## MSVC 14.51 C5285 on vendored doctest

MSVC 14.51 (May 2026) emits `C5285` on doctest's forward-declarations of `std::tuple`, which becomes an error under `/WX`. The fix is a targeted `/wd5285` suppression on the `slang-rhi-tests` target, or defining `DOCTEST_CONFIG_USE_STD_HEADERS`. Bumping vendored doctest to v2.6 does not work yet (unreleased) ([[wiki/learnings/1781056535440-msvc-14-51-c5285-on-vendored-doctest-std-tuple-sla.md]], [[wiki/learnings/1781056304699-slang-rhi-msvc-14-51-c5285-on-doctest-fixed-by-wd5.md]]).

## imgui Unity Build

imgui is consumed as a unity build in slang's `tools/platform/gui.cpp`. Bumping the submodule needs no CMake changes but requires `#define IMGUI_DEFINE_MATH_OPERATORS` before the first imgui include. Major API changes from v1.68 to v1.92.8 apply ([[wiki/learnings/1782235481283-imgui-in-slang-is-a-unity-build-bumping-it-needs-i.md]]).

## Coworker Container: /dev/shm Is Only 64MB

The slang coworker container has only 64MB of `/dev/shm` tmpfs. Parallel C++ builds cause SIGBUS in `cc1plus` from tmpfs exhaustion. Fix: set `TMPDIR` to an on-disk path and reduce build parallelism ([[wiki/learnings/1781716025205-slang-coworker-dev-shm-is-64m-parallel-c-builds-si.md]]).

## Downstream Compilers: Version Discovery

The loaded downstream compiler version (e.g. NVRTC major/minor) is already captured in `m_desc.version` via `getDesc()` on `IDownstreamCompiler`. A new public API to expose it should reuse `Session::getOrLoadDownstreamCompiler` and append a new virtual to `IGlobalSession` at the end of the vtable to remain non-breaking ([[wiki/learnings/1781171365104-slang-already-captures-the-loaded-downstream-compi.md]]).

Only DXC, glslang, and tint override `IDownstreamCompiler::getVersionString`. NVRTC falls through to the base which returns `SLANG_FAIL` and sets `*outVersionString = nullptr`. A public API returning NVRTC version must use the numeric `getDesc().version` path ([[wiki/learnings/1781172987354-nvrtc-downstream-compiler-has-no-getversionstring-.md]]).

## IRTextureType Format Operand

`IRTextureType`'s `format` operand is **optional** (requires `hasFormat()` guard; operand 8 only present when ≥9 operands). Synthesized format constants must use `getIntType()` not `getUIntType()` because the hoistable-type cache keys on the integer constant's type token — mismatched types prevent deduplication and can cause SIGSEGV ([[wiki/learnings/1780769319751-irtexturetype-format-operand-optional-and-int-vs-u.md]]).

`resolveTextureFormatForParameter` at `slang-ir-resolve-texture-format.cpp:54` is the only in-tree producer that synthesizes a fresh `format` constant; it must use `getIntType()` to match the schema (`hlsl.meta.slang:832 let format:int`). All format-operand readers are type-token-agnostic so this is a non-breaking foreclosure fix ([[wiki/learnings/1780769345401-slang-irtexturetype-format-operand-int-vs-uint-enc.md]]).

Prophylactic bug validation requires three checks: any present-day producer emits the colliding value, readers are sensitive to the drifting property, and the colliding producer is actually in master (not just an unmerged branch) ([[wiki/learnings/1780769176028-adjudicating-latent-prophylactic-schema-drift-clai.md]]).

## VK_KHR_shader_abort Implementation

`VK_KHR_shader_abort` follows the printf model for the frontend but differs crucially in SPIR-V emit: `OpAbortKHR` (opcode 5121) is a **Control-Flow terminator** taking a struct type + value, not a value-producing `OpExtInst`. Both the enum and capability are already vendored in spirv-headers so no submodule bump is needed ([[wiki/learnings/1781038945892-slang-vk-khr-shader-abort-is-printf-frontend-but-a.md]]). Adding it follows the printf model (capdef atoms, IR opcode, per-target emit) but differs in that `OpAbortKHR` requires `OpTypeStruct` + `OpCompositeConstruct` for its message; there is a naming collision with the existing HLSL SM4 `abort()` builtin requiring a design decision ([[wiki/learnings/1781072417779-slang-implementing-vk-khr-shader-abort-opabortkhr-.md]]).

## DescriptorHandle: Two Lowering Models

`DescriptorHandle<RaytracingAccelerationStructure>` has two incompatible lowering models: **plain bindless** (handle = 64-bit GPU device address → `OpConvertUToAccelerationStructureKHR`) vs **heap-indexed** (`spvDescriptorHeapEXT`, handle = heap index) ([[wiki/learnings/1781903775019-slang-descriptorhandle-accelerationstructure-two-m.md]]).

`DescriptorHandle<ConstantBuffer<T>>` wouldn't implicitly convert to `ConstantBuffer<T>` because a blanket guard in `_coerce` rejecting any `ParameterGroupType` target runs before constructor-based conversion search. Maintainer preferred full removal of the dubious guard since regression testing proved it non-load-bearing ([[wiki/learnings/1782151554268-slang-descriptorhandle-t-t-implicit-conversion-blo.md]]).

## slangd Config Settings: Two-Repo Job

Adding a VSCode-configurable slangd setting requires changes in **both** the slang repo (server-side config request + dispatch + application in `SessionDesc`) and the `slang-vscode-extension` repo (`package.json` declaration). Copy the `workspaceFlavor` template ([[wiki/learnings/1781797125582-adding-a-slangd-config-setting-is-a-two-repo-job-c.md]]).

Slangd config settings cannot be verified with slang-test. Require an LSP stdio probe that **responds** to the server's `workspace/configuration` pull. Notes on per-setting application differences and mid-session refresh patterns ([[wiki/learnings/1782172056258-verifying-slangd-lsp-config-settings-probe-must-an.md]]).

## slang-rhi Submodule Pin Lag

When verifying claims about `external/slang-rhi/` behavior, the pinned submodule in the slang repo may lag behind active feature work. A design/tracking issue authored by the feature developer often describes the world as it will be once their open PR lands ([[wiki/learnings/1781118704722-verifying-slang-rhi-claims-at-slang-head-the-submo.md]]).

## SLANG_OVERRIDE_*_PATH silently shadowed by a sibling dep's public include

A `SLANG_OVERRIDE_<DEP>_PATH` can be set yet silently ignored for a target's public-header consumers even though the dep's INTERFACE target correctly branches its include dir. The failure mode (#11851, imgui — generalizes to any bundled dep): a sibling dependency's *incidental public include* re-exposes the bundled-parent spelling, so the consumer resolves the bundled header instead of the override ([[wiki/learnings/1782852472140-slang-override-path-can-be-silently-shadowed-by-a-.md]], [[wiki/learnings/1782854132050-slang-override-dep-path-silently-fails-when-a-publ.md]]).

## git blame lies on shallow clones — use git log -S for provenance

On a shallow clone (`git clone --depth N`), `git blame` mis-attributes pre-boundary lines to the WRONG commit: the oldest commit visible at the boundary appears with a `^` prefix, which means "this line existed at or before the shallow boundary" — not "this commit introduced it." A blame that claims a 2021 line came from a 2026 PR is this artifact. Use `git log -S'<text>'` (pickaxe) for true provenance, or unshallow first ([[wiki/learnings/1782868921334-shallow-clones-depth-n-make-git-blame-mis-attribut.md]], [[wiki/learnings/1782869392078-git-blame-lies-on-shallow-clones-use-git-log-s-for.md]]).

## Local-build traps: ninja skips rebuild after git checkout; zombie-PID waiter; SPIR-V without spirv-dis

Three operational traps when reproducing bugs at HEAD: (1) after a `git checkout`, `ninja` may **skip** the rebuild because the checked-out source mtime is older than the existing object — touch the sources or clean to force it; (2) a background build waiter can hang on a zombie PID; (3) you can parse SPIR-V structurally without `spirv-dis` when the disassembler isn't loadable ([[wiki/learnings/1782871600830-slang-local-build-ninja-skips-rebuild-after-git-ch.md]]).

---
**Source learnings (28):**
- [[wiki/learnings/1781056304699-slang-rhi-msvc-14-51-c5285-on-doctest-fixed-by-wd5.md]] — MSVC C5285 on doctest fixed by /wd5285
- [[wiki/learnings/1781056535440-msvc-14-51-c5285-on-vendored-doctest-std-tuple-sla.md]] — MSVC 14.51 C5285 on vendored doctest
- [[wiki/learnings/1781118704722-verifying-slang-rhi-claims-at-slang-head-the-submo.md]] — slang-rhi submodule pin lags feature PRs
- [[wiki/learnings/1781171365104-slang-already-captures-the-loaded-downstream-compi.md]] — Slang captures downstream compiler version
- [[wiki/learnings/1781172987354-nvrtc-downstream-compiler-has-no-getversionstring-.md]] — NVRTC has no getVersionString override
- [[wiki/learnings/1781381821358-slang-build-tag-git-describe-release-version-clean.md]] — build tag = git-describe version
- [[wiki/learnings/1781716025205-slang-coworker-dev-shm-is-64m-parallel-c-builds-si.md]] — /dev/shm is 64M, parallel builds SIGBUS
- [[wiki/learnings/1781797125582-adding-a-slangd-config-setting-is-a-two-repo-job-c.md]] — adding slangd config is two-repo job
- [[wiki/learnings/1781903775019-slang-descriptorhandle-accelerationstructure-two-m.md]] — DescriptorHandle AccelerationStructure two models
- [[wiki/learnings/1782151554268-slang-descriptorhandle-t-t-implicit-conversion-blo.md]] — DescriptorHandle<T>→T implicit conversion blocked
- [[wiki/learnings/1782172056258-verifying-slangd-lsp-config-settings-probe-must-an.md]] — verifying slangd config settings probe
- [[wiki/learnings/1782235481283-imgui-in-slang-is-a-unity-build-bumping-it-needs-i.md]] — imgui unity build bump needs define
- [[wiki/learnings/1782762110953-slang-slang-use-system-options-all-find-package-no.md]] — SLANG_USE_SYSTEM_* options all find_package
- [[wiki/learnings/1780769176028-adjudicating-latent-prophylactic-schema-drift-clai.md]] — adjudicating latent schema-drift claims
- [[wiki/learnings/1780769319751-irtexturetype-format-operand-optional-and-int-vs-u.md]] — IRTextureType format operand optional int vs uint
- [[wiki/learnings/1780769345401-slang-irtexturetype-format-operand-int-vs-uint-enc.md]] — IRTextureType format operand int vs uint encoding
- [[wiki/learnings/1781038945892-slang-vk-khr-shader-abort-is-printf-frontend-but-a.md]] — VK_KHR_shader_abort is printf frontend but terminator
- [[wiki/learnings/1781072417779-slang-implementing-vk-khr-shader-abort-opabortkhr-.md]] — implementing VK_KHR_shader_abort OpAbortKHR
- [[wiki/learnings/1782852472140-slang-override-path-can-be-silently-shadowed-by-a-.md]] — SLANG_OVERRIDE_*_PATH can be silently shadowed by a sibling dep's incidental public include
- [[wiki/learnings/1782854132050-slang-override-dep-path-silently-fails-when-a-publ.md]] — SLANG_OVERRIDE_DEP_PATH silently fails when a public header uses the bundled-parent include spelling
- [[wiki/learnings/1782868921334-shallow-clones-depth-n-make-git-blame-mis-attribut.md]] — Shallow clones (--depth N) make git blame mis-attribute old lines to the clone boundary
- [[wiki/learnings/1782869392078-git-blame-lies-on-shallow-clones-use-git-log-s-for.md]] — git blame lies on shallow clones — use git log -S for provenance
- [[wiki/learnings/1782871600830-slang-local-build-ninja-skips-rebuild-after-git-ch.md]] — Local build: ninja skips rebuild after git checkout (mtime); zombie-PID waiter; parse SPIR-V without spirv-dis
_Catalog: [[wiki/index.md]]_
