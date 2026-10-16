---
title: "SlangPy Validation Against an Unreleased Slang PR"
type: concept
group: slangpy
tags: [slangpy, cross-repo, validation, no-gpu, slangc, companion-pr, ci-latest-slang, cpu-device, regression-masking]
source_count: 5
---

# SlangPy Validation Against an Unreleased Slang PR

How to prove that a SlangPy change, or a SlangPy companion PR that pre-adapts `slangpy/slang/*.slang`, behaves correctly against a Slang compiler that is not released yet, with GPU-free checks that complement GPU runs on the container's L40S, and how to read the downstream "SlangPy Tests" signal without being misled by import-time masking, CPU-backend noise, or a swapped library. The `SGL_LOCAL_SLANG` A/B mechanics for the C++ `sgl_tests` side live on [SlangPy GPU Validation and Cross-Repo Guards](slangpy-gpu-validation-and-cross-repo-guards.md); companion-PR merge order lives on [SlangPy build/CI toolchain](slangpy-f0909b0-build-ci-toolchain.md).

## TL;DR

- **Build only `slangc` + `slang-glslang` from the Slang PR head** (~10 min on 64 cores). Turn off LLVM, DXIL, tests, examples, GFX and slang-rhi. Without the `slang-glslang` target, SPIR-V output fails with `E00100` "failed to load downstream compiler 'spirv-opt'". With DXIL on and GLIBC < 2.38, configure builds DXC from source (~500 MB, 10-30 min).
- **CPU-device pytest gives almost no signal for texture code.** The CPU C++ backend can't do `operator[]` on a Texture with uint/vector indices, and int-format textures fail rhi `createTexture` before codegen. lavapipe can't host a slang-rhi Vulkan device either.
- **What does work without a GPU is compiling the generated kernels with `slangc`.** Dump them with `SLANGPY_PRINT_GENERATED_SHADERS=1 pytest -s` on cpu. Truncate each one after `compute_main`'s closing brace, because ANSI log lines get interleaved. Then compile every kernel for {pinned release, PR-head build} × {unpatched, patched slangpy module dir}. That is a clean 2×2 differential.
- **Identical `-target spirv-asm` output from the pinned compiler, patched vs unpatched, proves the change is a no-op on today's Slang.** Capture `$?` right after each `slangc`, because a `$(git rev-parse)` inside the `echo` overwrites it.
- **Front-end errors still show up in the cpu pytest run.** Grep for `error[E3` to tell "the Slang front end broke" apart from "a CPU backend limitation".
- **Know the CPU baseline noise before you call anything a regression.** `test_type_resolution -k texture --device-types=cpu` always has 5 Texture1D sint failures in rhi `createTexture`. Only "could not match the function signature" errors are compiler signal. A full CPU slangpy_tests run at main has about 167 pre-existing failures plus 3 aborts, so diff against a base build.
- **When a downstream run fails at `import slangpy`, everything after the import is unknown.** On slang#13537, fixing the core.slang import errors exposed a second, independent regression: `T` was no longer inferred from a `Texture2D<T>` argument. Fix the import, run again, and only then tell the maintainer the downstream break is fully known.
- **The Slang PR's own "SlangPy Tests" run builds slangpy `main`**, unless `SLANGPY_CHERRY_PICK_PR` is set. Its unique `core.slang:<line>` error locations are exactly what the companion must fix *for the import to succeed*. They are not the complete list of breaks.
- **To get the combined signal on a GPU before merging, dispatch slangpy CI yourself:** `gh workflow run ci-latest-slang.yml -R shader-slang/slangpy --ref <slangpy-branch> -f slang_branch=<slang PR branch>`. This only works for PR branches that live in shader-slang/slang.
- **Reverting the fix is not a valid control on the new compiler**, because the module then fails to import. Use "the same tests pass on the pinned compiler with the fix" plus a standalone `slangc` repro.
- **To get a GPU tally from PR CI,** grep `gh run view <id> --log` for the test name with `PASSED|SKIPPED` and group by job and `DeviceType`. Linux runs vulkan+cuda, Windows runs d3d12+vulkan+cuda, macOS runs metal.
- **Before trusting a "no difference" result, prove which library each arm loads.** A shared `LD_LIBRARY_PATH` makes a local slangc load the release `libslang-compiler` (`ldd`). Pointing `SGL_LOCAL_SLANG_BUILD_DIR` at the downloaded release artifact does the same thing on the SlangPy side.
- **`slangpy.__version__` names the source tree, not the build** — identify each A/B arm by `ldd slangpy_ext*.so | grep libslang-compiler` and `slangpy.__file__`.
- **A SlangPy wheel binary-links against a newer Slang, but its shipped `.slang` modules do not compile there**; read the bundled version from `slangpy.SLANG_BUILD_TAG`.

## Building just enough Slang from the PR head

Shallow-fetch the Slang PR head SHA and build only the compiler:

```bash
cmake --preset default -DSLANG_SLANG_LLVM_FLAVOR=DISABLE -DSLANG_ENABLE_DXIL=OFF \
  -DSLANG_DXC_BUILD_FROM_SOURCE=OFF -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF \
  -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF
cmake --build --preset release --target slangc slang-glslang -j48   # ~10 min on 64 cores
```

`SLANG_ENABLE_DXIL=OFF` is what stops FetchDXC from building DXC from source on a GLIBC < 2.38 container. That source build costs about 500 MB and 10-30 minutes, the same trap as the [cheap minimal static build](slang-tooling-build-runtime-libs.md). The `slang-glslang` target matters too: without it, every SPIR-V compile fails with `E00100 failed to load downstream compiler 'spirv-opt'`. When the build has to feed `SGL_LOCAL_SLANG` (a full Release that slangpy links against), `-DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE` took about 5 minutes on 48 cores. Pointing the submodule URLs at an existing local slang clone saves network ([verify a companion PR against an unmerged Slang PR's compiler](../learnings/1791935481120-verify-a-slangpy-companion-pr-against-an-unmerged-.md), [compile the generated kernels instead of trusting CPU pytest](../learnings/1791933953974-no-gpu-slangpy-validation-compile-the-generated-ke.md)).

One build-flake note. A slang-rhi FetchContent download of `Vulkan-Headers v1.4.347.zip` once failed its SHA256 check (`66a94201…` instead of `ac260b9d…`). Downloading again gave the right hash, so it was a transient bad download, not a supply-chain change. To make retries independent of GitHub, pin a verified local copy with `-DSLANG_RHI_VULKAN_HEADERS_URL=file:///…zip -DSLANG_RHI_VULKAN_HEADERS_URL_HASH=SHA256=ac260b9d…` ([CPU texture-test noise + Vulkan-Headers hash flake](../learnings/1791958376051-slangpy-test-type-resolution-texture-on-device-typ.md)).

## The no-GPU kernel-compile differential

On `DeviceType.cpu` (the only device when no GPU is available, as during the 2026-09-28→10-16 host passthrough outage; containers otherwise have an L40S, so also run the vulkan/cuda devices), pytest tells you nothing about texture code (see the next section), and lavapipe can't stand in for a GPU (see [SlangPy build & infra](slangpy-build-and-infra-operations.md)). Codegen still runs on cpu, though. So the reliable signal is to compile the kernels SlangPy actually generates:

1. Run the test on cpu with `SLANGPY_PRINT_GENERATED_SHADERS=1 pytest ... -s`. Every kernel is printed between the `*/` line and the `====` line. Extract each one and truncate it after `compute_main`'s closing `}`, because log lines (with ANSI escapes) get interleaved into the dump.
2. Compile each kernel with `slangc k.slang -I <slangpy>/slangpy/slang -I <tests dir> -target spirv -entry compute_main -stage compute`. Do this for {pinned release, PR-head build} × {unpatched, patched module dir}. That gives a 2×2 differential: the patch should be a no-op on the pinned compiler and a fix on the PR compiler.
3. When there is no test to dump, write a small harness instead. Use `import slangpy;` plus a compute entry point that takes `uniform Texture2DType<vector<int,1>>`-style parameters and calls `__slangpy_load`/`__slangpy_store`. Compile it with `-I <checkout>/slangpy/slang` for each of spirv/hlsl/cuda/metal, against both the old checkout and the PR checkout. Capture `$?` immediately after each call: a `$(git rev-parse)` inside the reporting `echo` overwrites it.
4. Diff the `-target spirv-asm` output from the **pinned** compiler, patched vs unpatched. If it is byte-identical, the companion change is a provable no-op on current Slang. That is the strongest "safe to merge before the Slang PR" evidence you can get without hardware.

The autodiff variant of the same idea (HLSL target, a `timeout` around each `slangc`, kernel sources matched to the compiler version) is on [SlangPy build & infra](slangpy-build-and-infra-operations.md) ([compile the generated kernels](../learnings/1791933953974-no-gpu-slangpy-validation-compile-the-generated-ke.md), [verify a companion PR against an unmerged Slang PR](../learnings/1791935481120-verify-a-slangpy-companion-pr-against-an-unmerged-.md)).

## What CPU-device pytest can and cannot tell you

The CPU (C++) backend has texture limitations that have nothing to do with the compiler change you are testing. `operator[]` on a Texture with uint/vector indices fails on cpu even at main (`test_texture_2d_broadcast` fails there too), and int-format textures fail rhi `createTexture` before any codegen. Front-end errors (`E3xxxx`) do still surface through the cpu run. Grep for `error[E3` to separate "the Slang front end broke" from "the CPU backend can't do this".

Concretely, `pytest slangpy/tests/slangpy_tests/test_type_resolution.py -k texture --device-types=cpu` always has 5 compiler-independent failures: func_int / func_genericint / func_int3 / func_vector3_generic / func_vectorN_generic with Texture1D r32/rgb32/rgba32_sint. All 5 fail in rhi `createTexture` (`SLANG_FAIL`, `resource.cpp:523`), before type resolution runs. Only cases whose error is "could not match the function signature" are compiler signal. Against slang#13537 head `df67203e` + SlangPy main `4d30f6fc`, the run was 8 failed / 26 passed: 5 noise + 3 real (func_texture2d_generic r32/rgba32_float and func_rwtexture2d_generic rgba32_float, the `Texture2D<T>` generic-inference regression). For a whole-suite run, the baseline is worse. A full CPU slangpy_tests run at main `89d4917` already has about 167 failures (CPU textures, the `InterlockedAddF32` emit error, command buffer) plus 3 aborting `test_texture_return_value` uint8 cases. Diff against a base build before you call anything a regression ([5 Texture1D sint cpu cases always fail](../learnings/1791958376051-slangpy-test-type-resolution-texture-on-device-typ.md), [compile the generated kernels](../learnings/1791933953974-no-gpu-slangpy-validation-compile-the-generated-ke.md), [to_ndarray strides + full-CPU-run baseline](../learnings/1792033380879-slangpy-to-ndarray-struct-innermost-exposed-as-uin.md)).

## Reading the downstream "SlangPy Tests" run: an import failure hides later regressions

The Slang PR's downstream "SlangPy Tests" run (slangpy `ci-latest-slang.yml`, job `build-pr`) builds slangpy **`main`** against the PR's compiler, unless `SLANGPY_CHERRY_PICK_PR` is set on slang master. Its unique `core.slang:<line>` error locations are exactly what the companion PR must fix. But that is only the set that stops `import slangpy`, not the complete list of downstream breaks.

Consider slang#13537 (texture format descriptors). The first downstream run failed at `import slangpy` with core.slang wrapper errors (`E30027`/`E30019`). Fixing those wrappers in slangpy#1220 and running again exposed a **second, independent** regression. Generic `T` was no longer inferred from a `Texture2D<T>` argument:

```slang
void f<T : ITexelElement>(Texture2D<T> t);
f(myTexture2DFloat4);   // E39999 "could not specialize generic"; explicit f<float4>(...) works
```

SlangPy's `test_type_resolution_texture[func_texture2d_generic*]` catches it. That gives three rules:

- **Treat a module-import failure as "unknown beyond this point".** Fix the import, run again, and only then report the downstream break as fully known.
- **Get the combined signal before either PR merges.** Dispatch on the slangpy fix branch with `gh workflow run ci-latest-slang.yml -R shader-slang/slangpy --ref <slangpy-branch> -f slang_branch=<slang PR head branch>`. Branch mode hard-codes shader-slang/slang, so this only works for PR branches inside that repo. A fork PR has to use the local build above.
- **Don't use "revert the fix" as the control on the new compiler.** With the fix reverted the module doesn't import, so every test fails for the wrong reason. Use "the same tests pass on the pinned compiler with the fix" plus a standalone `slangc` repro of the new regression.

For the GPU half from ordinary PR CI, tally the new test per backend. `gh run view <id> --log` prints tab-separated job/step/line, so grep for the test name and `PASSED|SKIPPED`, then group by job and `DeviceType`. Linux CI runs vulkan+cuda, Windows runs d3d12+vulkan+cuda, and macOS runs metal ([downstream failures can hide later regressions](../learnings/1791941484429-downstream-slangpy-failures-can-hide-later-regress.md), [verify a companion PR against an unmerged Slang PR](../learnings/1791935481120-verify-a-slangpy-companion-pr-against-an-unmerged-.md)).

## Prove which compiler each arm actually ran

The same slang#13537 regression was hidden a second time by a library swap. One `LD_LIBRARY_PATH=<release>/lib` exported for every arm of an A/B loop made the locally built slangc load the release `libslang-compiler` (the sonames matched), so the PR arm behaved exactly like the release. Run `ldd <slangc> | grep slang` with the loop's environment whenever an A/B shows "no difference". The full rule is on [Build System, Prebuilt Deps & CMake Options](slang-tooling-build-runtime-libs.md). The SlangPy-side version of the trap is `-DSGL_LOCAL_SLANG_BUILD_DIR` pointed at the downloaded `build/slang-<ver>-linux-x86_64/` release artifact instead of `build/Release`, which makes both arms come back clean. Its `strings`/`ldd` proof is on [SlangPy GPU Validation and Cross-Repo Guards](slangpy-gpu-validation-and-cross-repo-guards.md).

**Every local SlangPy build reports the same `__version__`.** A local `pip install /workspace/agent/slangpy` reports the version string of the source tree, so on 2026-10-16 main b89a3827 (Slang 2026.19) and an older local build (Slang 2026.17.1) both printed `slangpy=0.43.0`; `dist-info/direct_url.json` reading `file:///…` marks a local build, not the PyPI release. Name each arm of a with/without-fix A/B by its Slang instead, `ldd <slangpy>/slangpy_ext*.so | grep libslang-compiler` plus `python -c 'import slangpy; print(slangpy.__file__)'`, and put both in the run log; Codex OUTPUT_REVIEW blocked a public comment until the log carried that provenance. SlangPy main pins its Slang as `SGL_SLANG_VERSION` in `external/CMakeLists.txt`, so when the fix is already in that release the stock main build suffices and no `SGL_LOCAL_SLANG` rebuild is needed [local SlangPy builds all report the same __version__](../learnings/1792136974641-slangpy-local-builds-all-report-the-same-version-s.md).

**A wheel is locked to one Slang at the `.slang` level, not the binary level (slangpy#1226).** The stock 0.43.1 wheel (built for Slang 2026.12) links and runs against Slang 2026.19 when that library is forced in with an `RTLD_GLOBAL` preload or an `LD_LIBRARY_PATH` symlink: all 103 imported symbols resolve and `SLANG_BUILD_TAG` reports 2026.19. The shipped `.slang` modules then fail (`slangpy/slang/staticarray.slang:10`, `E30019 expected 'MatrixLayoutMode'`, from slang#12986), and main's copy fails on 2026.12 (E30015). So "run a wheel against a newer external Slang" needs `.slang` sources that compile on several Slang versions plus CI against newer Slang, not documentation. Two Slangs can share one Linux process, because `libslang-compiler.so.0.<ver>` has a versioned SONAME: with another Slang already loaded `RTLD_LOCAL`, SlangPy still binds its bundled copy, and it breaks only when the other library is loaded `RTLD_GLOBAL` before slangpy is imported (Windows DLL names carry no version, so the first loaded wins; untested). Release bodies are empty; the bundled Slang version appears only in `docs/changelog.rst` or at runtime as `slangpy.SLANG_BUILD_TAG` [SlangPy wheels are locked to one Slang version at the .slang level](../learnings/1792145562307-slangpy-wheels-are-locked-to-one-slang-version-at-.md).

**Source learnings (5):**

- [Verify a slangpy companion PR against an unmerged Slang PR's compiler locally (no GPU)](../learnings/1791935481120-verify-a-slangpy-companion-pr-against-an-unmerged-.md) — slangc + slang-glslang minimal build; harness across 4 targets; spirv-asm no-op diff; PR-CI tally by DeviceType; ci-latest-slang branch dispatch
- [Downstream SlangPy failures can hide later regressions](../learnings/1791941484429-downstream-slangpy-failures-can-hide-later-regress.md) — import failure = unknown beyond; slang#13537 `Texture2D<T>` inference regression surfaced only after slangpy#1220; revert is not a valid control
- [SlangPy test_type_resolution_texture on --device-types=cpu: 5 Texture1D sint cases always fail](../learnings/1791958376051-slangpy-test-type-resolution-texture-on-device-typ.md) — compiler-independent rhi `createTexture` failures; only "could not match the function signature" is signal; transient Vulkan-Headers SHA256 mismatch + local-URL pin
- [SlangPy local builds all report the same __version__, so name a regression control by its bundled libslang-compiler version (ldd)](../learnings/1792136974641-slangpy-local-builds-all-report-the-same-version-s.md) — `direct_url.json` file://; `SGL_SLANG_VERSION` pin
- [SlangPy wheels are locked to one Slang version at the .slang level, not the binary level](../learnings/1792145562307-slangpy-wheels-are-locked-to-one-slang-version-at-.md) — symbols resolve on 2026.19, `staticarray.slang` E30019; versioned SONAME coexistence (slangpy#1226)
