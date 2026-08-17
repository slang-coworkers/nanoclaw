---
title: "Slang Build Infrastructure, Tooling, and Language Server"
type: concept
group: slang-grab-bag
tags: [build, CMake, MSVC, slangd, LSP, language-server, build-tag, version, downstream-compilers, NVRTC, VK_KHR_shader_abort, SPIR-V, IRTextureType, imgui, dev-shm, coworker-container, binary-provenance, core-module, stale-slangc]
source_count: 55
---

# Slang Build Infrastructure, Tooling, and Language Server

## TL;DR

- `spGetBuildTagString()` is `git describe`; a clean string (no `-N-gSHA`) means built exactly at that tag. But `slangc -v` is a CMake-cached value — a bisect trap; touch/reconfigure or it reports the stale version.
- 7 `SLANG_USE_SYSTEM_*` options, all `find_package` (no `_ROOT_DIR`); they have NO bundled fallback, and there are three separate dep-locating conventions (USE_SYSTEM / hand-written `Find*.cmake` / `SLANG_OVERRIDE_*_PATH`).
- `SLANG_OVERRIDE_*_PATH` can be silently shadowed by a sibling dep's public include — verify which header actually resolves.
- MSVC quirks that only bite in CI: 14.51 `C5285` on vendored doctest under `/WX` (fix `/wd5285` on the test target); `/W4 /WX` makes `C4456` shadow-decl an error invisible to local gcc/clang; `/DEBUG` for Release PDBs silently disables `/OPT:REF` + `/OPT:ICF`.
- `git blame` lies on shallow clones — use `git log -S` for provenance. Local ninja skips rebuild after `git checkout`; watch for a zombie-PID waiter and SPIR-V-without-spirv-dis traps.
- `if constexpr` does NOT discard branches in a non-template function — both arms must compile.
- Container build env: `/dev/shm` is only 64 MB in the coworker container.
- Downstream-compiler version discovery, `IRTextureType` format operand, `VK_KHR_shader_abort`, and DescriptorHandle's two lowering models are documented below.
- Companion page [[wiki/concepts/slang-misc-build-infrastructure-and-tooling-2.md]] covers packaging (WASM/CPack), `EXCLUDE_FROM_ALL` generators, the capability-generator, stale-PCH FIDDLE-state codegen errors, and binary-provenance traps (a stale prebuilt `slangc` embeds the OLD core module).

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

## SLANG_OVERRIDE_*_PATH silently shadowed by a sibling dep's public include

A `SLANG_OVERRIDE_<DEP>_PATH` can be set yet silently ignored for a target's public-header consumers even though the dep's INTERFACE target correctly branches its include dir. The failure mode (#11851, imgui — generalizes to any bundled dep): a sibling dependency's *incidental public include* re-exposes the bundled-parent spelling, so the consumer resolves the bundled header instead of the override ([SLANG_OVERRIDE_*_PATH can be silently shadowed by a sibling dep's incidental public include](wiki/learnings/1782852472140-slang-override-path-can-be-silently-shadowed-by-a-.md), [SLANG_OVERRIDE_DEP_PATH silently fails when a public header uses the bundled-parent include spelling](wiki/learnings/1782854132050-slang-override-dep-path-silently-fails-when-a-publ.md)).

## git blame lies on shallow clones — use git log -S for provenance

On a shallow clone (`git clone --depth N`), `git blame` mis-attributes pre-boundary lines to the WRONG commit: the oldest commit visible at the boundary appears with a `^` prefix, which means "this line existed at or before the shallow boundary" — not "this commit introduced it." A blame that claims a 2021 line came from a 2026 PR is this artifact. Use `git log -S'<text>'` (pickaxe) for true provenance, or unshallow first ([Shallow clones (--depth N) make git blame mis-attribute old lines to the clone boundary](wiki/learnings/1782868921334-shallow-clones-depth-n-make-git-blame-mis-attribut.md), [git blame lies on shallow clones — use git log -S for provenance](wiki/learnings/1782869392078-git-blame-lies-on-shallow-clones-use-git-log-s-for.md)).

## Local-build traps: ninja skips rebuild after git checkout; zombie-PID waiter; SPIR-V without spirv-dis

Three operational traps when reproducing bugs at HEAD: (1) after a `git checkout`, `ninja` may **skip** the rebuild because the checked-out source mtime is older than the existing object — touch the sources or clean to force it; (2) a background build waiter can hang on a zombie PID; (3) you can parse SPIR-V structurally without `spirv-dis` when the disassembler isn't loadable ([Slang local build: ninja skips rebuild after git checkout (source mtime < object); zombie-PID waiter trap; parse SPIR-V without spirv-dis](wiki/learnings/1782871600830-slang-local-build-ninja-skips-rebuild-after-git-ch.md)).

## `slangc -v` version string is a cached CMake value — bisect trap

`slangc -v` prints a `git describe` string baked in at **CMake configure time** and cached; an incremental `cmake --build` after a bare `git checkout <other-commit>` recompiles the source but does NOT re-run configure, so the version string stays frozen — a binary built from commit X can report commit Y's version, and a machine's prebuilt `build/Debug/bin/slangc` tells you nothing reliable about which commit it was built from ([Slang slangc -v version string is a cached CMake value, NOT proof of compiled commit (bisect trap)](wiki/learnings/1782898953945-slang-slangc-v-version-string-is-a-cached-cmake-va.md)). This bit a #11877 bisect: trusting the cached string concluded the regression "predated #11493" and even fingered an IR-only pass for a front-end overload-resolution regression — mechanically impossible, which is what exposed the trap. For "which commit does this binary correspond to?" / bisect endpoints, never trust the version string: (1) fresh-build (reconfigure, not a stale cache) the exact commit, and (2) cross-check with a source-level symbol — `nm -C build/Debug/lib/libslang-compiler.so | grep -c <symbol-added-by-suspect-commit>` (here `convertToBuiltinArithmeticOp`, added by #11493) — GOOD→BAD should correlate with symbol-absent→symbol-present, not the version string. A `git bisect` bad endpoint is *assumed*, not tested; re-verify it with a fresh build, especially when the blamed commit couldn't mechanically cause the symptom ([Slang bisect: don't trust slangc's version string for commit identity](wiki/learnings/1782899060456-slang-bisect-don-t-trust-slangc-s-version-string-f.md)).

## MSVC `/W4 /WX` flags C4456 shadow-declaration as error — invisible to local gcc/clang

Slang's Windows-CL build legs compile with MSVC `/W4 /WX`, treating **C4456** ("declaration hides previous local") — and C4457/C4458/C4459 (hides param/member/global) — as a hard error; the gcc/clang legs do NOT enable `-Wshadow`, so a variable-shadowing mistake compiles clean on every Linux/macOS build and only fails on `build-windows-*-cl` (e.g. #11873: hoisting `auto astBuilder` shadowed a nested one — 7 gcc/clang builds green, both Windows-CL red). Cheap local pre-check: run `-Wshadow -fsyntax-only` on the changed TU using its exact command from `build/compile_commands.json` (empty output = MSVC-clean). When CI shows a Windows-CL-only failure while all gcc/clang builds pass, suspect an MSVC-specific diagnostic (shadow, unreferenced-local, signed/unsigned, `/permissive-` conformance) BEFORE assuming infra/flake — read the actual `error Cxxxx` via `gh api repos/<o>/<r>/actions/jobs/<jobId>/logs` (works mid-run) ([MSVC /W4 /WX flags C4456 shadow-declaration as error — invisible to local gcc/clang builds](wiki/learnings/1782956138561-msvc-w4-wx-flags-c4456-shadow-declaration-as-error.md)).

## RequiredLoweringPassSet gating (#11917) + local FileCheck IS bundled

Generalizing `RequiredLoweringPassSet` gating (#11917, 'avoid backend IR passes when they cannot apply'): the set is already re-scanned once post-specialization, so the generalization builds on existing machinery ([1783026531085-slang-11917-generalizing-requiredlower](wiki/learnings/1783026531085-slang-11917-generalizing-requiredloweringpassset-g.md)). Correcting a stale belief along the way: **local FileCheck IS bundled** after a Slang build — the old 'no local FileCheck → filecheck= tests ignored, verify via slangc+grep' guidance is out of date ([1783031485208-local-filecheck-is-bundled-requiredlow](wiki/learnings/1783031485208-local-filecheck-is-bundled-requiredloweringpassset.md)).

## Slang CI common-setup maps releaseWithDebugInfo → RelWithDebInfo config dir

Don't assume the CMake config dir equals the preset name: `.github/actions/common-setup/action.yml` maps the `releaseWithDebugInfo` preset to the `RelWithDebInfo` config directory for `bin_dir`/`lib_dir` ([1783060729289-slang-ci-common-setup-maps-the-release](wiki/learnings/1783060729289-slang-ci-common-setup-maps-the-releasewithdebuginf.md)). When delivering a workflow-file-only change, the bot App cannot push it — deliver the diff as an issue comment and point at the RelWithDebInfo output dir ([1783059878582-delivering-workflow-file-changes-diff-](wiki/learnings/1783059878582-delivering-workflow-file-changes-diff-as-issue-com.md)).

## ASan/LSan build gotchas + public-header ODR under mixed ASan

Verifying a leak fix under ASan/LSan: `detect_leaks=0` is needed *during the build itself*, a full ASan build won't fit ~9.4G disk, and there's a verify-without-link trick to sidestep the link step ([1783079812616-slang-asan-lsan-build-detect-leaks-0-d](wiki/learnings/1783079812616-slang-asan-lsan-build-detect-leaks-0-during-build-.md)). For public-header (`include/`) ODR-under-mixed-ASan work (#11927, burning down #11926's `detect_odr_violation=2` list), only certain header constructs are actual `detect_odr_violation` offenders ([1783059512544-slang-public-header-odr-under-mixed-as](wiki/learnings/1783059512544-slang-public-header-odr-under-mixed-asan-11927-whi.md)).

## if constexpr does NOT discard branches in a non-template function

A common 'convert `#if` dead code to `if constexpr` to keep it type-checked' ask is unsafe in a **non-template** function: `if constexpr` only discards in a template instantiation, so in ordinary code both branches are fully compiled — the dead branch must still type-check against real types ([1783059299573-if-constexpr-does-not-discard-branches](wiki/learnings/1783059299573-if-constexpr-does-not-discard-branches-in-a-non-te.md)).

## Triaging 'use library allocation wrappers' + mimalloc-for-core is not turn-key

For 'use library allocation wrappers' issues (#11924), separate latent from live and caller-owned from library-owned buffers before acting ([1783057786633-triaging-use-library-allocation-wrappe](wiki/learnings/1783057786633-triaging-use-library-allocation-wrappers-issues-la.md)). 'Use mimalloc for Slang core' (#11925) is **not** a turn-key reuse of the existing SPIRV-Tools mimalloc dependency — the mechanism doesn't transfer ([1783058024375-mimalloc-for-slang-core-is-not-a-turn-](wiki/learnings/1783058024375-mimalloc-for-slang-core-is-not-a-turn-key-reuse-of.md)). And the #11928 dead-code removal (`USE_RIFF`/`DIRECT_FROM_FOSSIL`) was only partially done, superseded by PR #11930 ([1783125158769-postmortem-slang-11928-superseded-by-p](wiki/learnings/1783125158769-postmortem-slang-11928-superseded-by-pr-11930-part.md)).

### mimalloc integration mechanics (#12036/#12101/#12102) — three load-bearing facts

The new `SLANG_ENABLE_MIMALLOC` override from PR #12036 (distinct from the long-existing `SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC`, on master since #8419 — always cross-check merge state with `gh pr view --json mergedAt`, a code-reader that reads the old option wrongly concludes #12036 merged) wires `mimalloc-new-delete.h`, which **overrides only C++ `operator new`/`delete`, NOT C allocation**. Slang core has ~24 raw `::malloc`/`::free`/`::realloc`/`posix_memalign` sites across ~12 files (notably `StandardAllocator` at `slang-allocator.h:41,45`, the default `List<T>` allocator, plus `slang-blob.h`, `slang-memory-arena.cpp`, `ScopedAllocation`, aligned-alloc, etc.). A new/delete-only override that leaves those C paths on the system allocator is a **mixed-allocator hazard** (mimalloc `operator new` freed by system `::free` → heap corruption) — exactly why upstream SPIRV-Tools force-sets `MI_OVERRIDE=0` off-Windows and why #12036 defaults ON only for shared MSVC Windows. Extending it cross-platform (#12101) is a per-platform ABI/default-on **policy decision** (operator-override-only-opt-in vs full mimalloc-for-core / Mechanism B of #11925 vs keep-Windows-only), not a mechanical fix ([mimalloc global new-delete override is C++-only — raw C alloc sites are the cross-platform blocker (#12101/#12036)](wiki/learnings/1784052930371-mimalloc-global-new-delete-override-is-c-only-raw-.md)).

**mimalloc is Slang's ONLY configure-time-download dep** (#12102, promote the silent fetch to a `FATAL_ERROR`): `external/mimalloc` is NOT a submodule — no `.gitmodules` entry on master or the #12036 head — it's fetched on demand via `git clone --depth 1 --branch v2.1.7 ... OUTPUT_QUIET ERROR_QUIET` (`external/CMakeLists.txt:268-281`), whereas every other dep is a submodule that fails fatally via `add_subdirectory()`. The fetch resolves a **mutable, unpinned** git tag under `ERROR_QUIET`, and post-#12036 that checkout links `mimalloc-static` into `slang` replacing global new/delete for the whole compiler DLL — so a moved/compromised tag = arbitrary code in the shipped allocator. Key triage lesson: the "just make it an error" one-liner is NOT standalone — `SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC` defaults ON on Windows, so a bare `FATAL_ERROR` without vendoring the source first breaks fresh Windows clones. The principled fix couples both: **vendor mimalloc as a SHA-pinned submodule, THEN delete the fetch + error on missing source** (the #12036 head's partial `FATAL_ERROR` fires only on download *failure* and does NOT close the hole — a moved-tag fetch still succeeds silently). General pattern: when a build-hardening ask says "turn a silent fetch into an error," first check whether the source is vendored ([mimalloc is Slang's only configure-time-download dep; making it an error is gated on submodule-vendoring first](wiki/learnings/1784053617554-mimalloc-is-slang-s-only-configure-time-download-d.md)).

**There is exactly ONE mimalloc in a Slang build, whatever Slang pins.** When SPIRV-Tools is built as a subdirectory inside Slang it does NOT fetch its own mimalloc: Slang's `external/CMakeLists.txt` sets `mimalloc_SOURCE_DIR = ${MIMALLOC_PATH}` and `SPIRV_TOOLS_USE_MIMALLOC` before `add_subdirectory(spirv-tools)`, and SPIRV-Tools' CMake then does `set(MIMALLOC_DIR ${mimalloc_SOURCE_DIR}) → add_subdirectory(...)` — both link the SAME single `mimalloc-static` target (name unchanged across 2.1.7/2.3.2/3.3.2, so #12036's `target_link_libraries(slang PRIVATE mimalloc-static)` is version-agnostic). The `external/spirv-tools/DEPS` `mimalloc_revision` is a gclient/gn field NEVER read by CMake — inert when spirv-tools builds inside Slang — so "match whatever spirv-tools uses" means reading DEPS for reference only; pinning Slang's `external/mimalloc` to a different commit than DEPS names is NOT a two-versions mismatch. Corollary: mimalloc tags are ANNOTATED (deref with `git ls-remote <repo> 'refs/tags/vX.Y.Z^{}'`) and version-decode via `include/mimalloc.h` `MI_MALLOC_VERSION` (20302 = v2.3.2); a perf regression measured in both 2.3.2 and 3.3.2 reconciled the pin back to v2.1.7 `8c532c32c3` (the original pre-#12036 pin) ([slang external/mimalloc feeds SPIRV-Tools' build; spirv-tools DEPS is NOT a CMake input](wiki/learnings/1784083959740-slang-external-mimalloc-feeds-spirv-tools-build-sp.md)).

**Source learnings (39):**
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
- [SLANG_OVERRIDE_*_PATH can be silently shadowed by a sibling dep's incidental public include](wiki/learnings/1782852472140-slang-override-path-can-be-silently-shadowed-by-a-.md)
- [SLANG_OVERRIDE_DEP_PATH silently fails when a public header uses the bundled-parent include spelling](wiki/learnings/1782854132050-slang-override-dep-path-silently-fails-when-a-publ.md)
- [Shallow clones (--depth N) make git blame mis-attribute old lines to the clone boundary](wiki/learnings/1782868921334-shallow-clones-depth-n-make-git-blame-mis-attribut.md)
- [git blame lies on shallow clones — use git log -S for provenance](wiki/learnings/1782869392078-git-blame-lies-on-shallow-clones-use-git-log-s-for.md)
- [Local build: ninja skips rebuild after git checkout (mtime); zombie-PID waiter; parse SPIR-V without spirv-dis](wiki/learnings/1782871600830-slang-local-build-ninja-skips-rebuild-after-git-ch.md)
- [slangc -v version string is a cached CMake value, NOT proof of compiled commit (bisect trap)](wiki/learnings/1782898953945-slang-slangc-v-version-string-is-a-cached-cmake-va.md)
- [Slang bisect: don't trust slangc's version string; verify by fresh build + nm symbol check](wiki/learnings/1782899060456-slang-bisect-don-t-trust-slangc-s-version-string-f.md)
- [MSVC /W4 /WX flags C4456 shadow-declaration as error — invisible to local gcc/clang builds](wiki/learnings/1782956138561-msvc-w4-wx-flags-c4456-shadow-declaration-as-error.md)
- [#11917 generalizing RequiredLoweringPassSet gating; set is re-scanned once post-specialization](wiki/learnings/1783026531085-slang-11917-generalizing-requiredloweringpassset-g.md)
- [Local FileCheck IS bundled (stale belief corrected); RequiredLoweringPassSet gating (#11917)](wiki/learnings/1783031485208-local-filecheck-is-bundled-requiredloweringpassset.md)
- [Slang CI common-setup maps releaseWithDebugInfo preset → RelWithDebInfo config dir](wiki/learnings/1783060729289-slang-ci-common-setup-maps-the-releasewithdebuginf.md)
- [Delivering workflow-file changes: diff-as-issue-comment + RelWithDebInfo output-dir](wiki/learnings/1783059878582-delivering-workflow-file-changes-diff-as-issue-com.md)
- [ASan/LSan build: detect_leaks=0 during build, won't fit ~9.4G disk, verify-without-link trick](wiki/learnings/1783079812616-slang-asan-lsan-build-detect-leaks-0-during-build-.md)
- [Public-header ODR under mixed ASan (#11927): which header constructs are/aren't offenders](wiki/learnings/1783059512544-slang-public-header-odr-under-mixed-asan-11927-whi.md)
- [if constexpr does NOT discard branches in a non-template function](wiki/learnings/1783059299573-if-constexpr-does-not-discard-branches-in-a-non-te.md)
- [Triaging 'use library allocation wrappers' — latent vs live, caller- vs library-owned buffers](wiki/learnings/1783057786633-triaging-use-library-allocation-wrappers-issues-la.md)
- [mimalloc 'for Slang core' is not a turn-key reuse of the SPIRV-Tools integration](wiki/learnings/1783058024375-mimalloc-for-slang-core-is-not-a-turn-key-reuse-of.md)
- [postmortem: #11928 superseded by PR #11930 (partial dead-code removal)](wiki/learnings/1783125158769-postmortem-slang-11928-superseded-by-pr-11930-part.md)
- [mimalloc global new-delete override is C++-only — raw C alloc sites are the cross-platform blocker (#12101/#12036)](wiki/learnings/1784052930371-mimalloc-global-new-delete-override-is-c-only-raw-.md)
- [mimalloc is Slang's only configure-time-download dep; making it an error is gated on submodule-vendoring first (#12102)](wiki/learnings/1784053617554-mimalloc-is-slang-s-only-configure-time-download-d.md)
- [slang external/mimalloc feeds SPIRV-Tools' build; spirv-tools DEPS is NOT a CMake input](wiki/learnings/1784083959740-slang-external-mimalloc-feeds-spirv-tools-build-sp.md)

_Catalog: [[wiki/index.md]]_
