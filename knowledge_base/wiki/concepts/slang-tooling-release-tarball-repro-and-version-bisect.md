---
title: "Reproducing version-specific Slang bugs with release tarballs, and bisecting across releases"
type: concept
group: slang-tooling
tags: [slang, release-tarball, gh-release-download, bisect, version-matrix, nvrtc, ptx, cuda, c-api, libslang-compiler, exit-codes, triage, regression]
source_count: 17
---

# Reproducing version-specific Slang bugs with release tarballs, and bisecting across releases

The prebuilt Linux release tarballs of Slang answer "does version X have this bug?" without a CMake build. This page covers how to fetch and run them, how to use them for CUDA/PTX triage, how to bisect a C++ API regression by linking a tiny program against each tarball, the pitfalls that make a run look like a pass or a fail when it is not, and the version matrices measured for several issues.

## TL;DR

- A release tarball answers a version question in seconds to about a minute per version. No CMake build, no GPU.
- Fetch with `gh release download v<ver> -R shader-slang/slang -p "slang-<ver>-linux-x86_64.tar.gz"`, or take the asset `browser_download_url` from `gh api repos/shader-slang/slang/releases/tags/v<ver>`. Extract with `tar`.
- Run `bin/slangc` from the extracted directory. Set `LD_LIBRARY_PATH=<dir>/lib` so it loads its own libraries.
- Always test at least two versions: the one the reporter used and the latest release. For a fix or a regression, add the release just before and just after the change.
- Find the fix commit with `git log -- <test>` on a shallow clone. Map it to releases with `gh release list` dates, or check that the fix PR appears in the `v<A>...v<B>` compare. When the issue itself is off limits (eval triage), grep that compare's commit subjects for the keyword: bot fix PRs are titled "Fix #<n>: …".
- Bisect library source across tags without a clone: fetch a file at a tag through the contents API with `Accept: application/vnd.github.raw` and grep it.
- `-target ptx` runs NVRTC, so it is a real CUDA compile check that shows NVRTC errors in seconds.
- For C++ compilation-API bugs, link a tiny repro against each tarball: `g++ -std=c++17 repro.cpp -I<X>/include -L<X>/lib -lslang-compiler -Wl,-rpath,$PWD/<X>/lib`. Use `-lslang` if `libslang-compiler.so` is absent.
- A runtime result on real release binaries is stronger evidence than "reproduced by code inspection".
- slangc can print an NVRTC error and still exit 0. Check for the output file or grep stderr.
- Release builds hide ICE text. A crash is often exit 139 with no message. Check `$?`.
- `| head` hides the exit code of the command before it. Use `${PIPESTATUS[0]}`.
- Older slangc releases (v2025.1x) write nothing for `-o -`. Write to a real file (`-o out.glsl`) in any cross-version run, or "no output" is scored as a failure.
- Run every target the report names (spirv, hlsl, cuda, glsl) and the nearby source variants. One target or one variant is not a matrix.
- After a release bracket, list the commits in that window and name the trigger. A window can hold an unrelated suspect.
- A crash report on a version older than the fix release is already fixed: tell the reporter to upgrade. A report that still fails on the fix release or later is probably a separate variant: check for one before reopening.
- A fix PR merged on the same day as a release tag can miss that release. Compare the PR's merge time with the tag time, not only the date.
- `-skip-codegen` and `-target none` still run IR lowering. A crash under them does not prove a checker crash; use a debug build or a backtrace.
- A matrix of constraint or source variants on one release is a good acceptance test set for a fix.
- Re-check open issues on each new release. The latest per-issue status table is in "Worked version matrices" below.

## Fetching and running a release

To check a bug against an older release, download that version's Linux tarball and run its `bin/slangc` on the repro. Two equivalent ways to fetch it work: `gh release download v<ver> -R shader-slang/slang -p "slang-<ver>-linux-x86_64.tar.gz"`, or the asset's `browser_download_url` from `gh api repos/shader-slang/slang/releases/tags/v<ver>`. Each version takes under a minute ([release tarball repro, #12634 Texture3D SampleLevel](../learnings/1792152922166-repro-version-specific-slangc-bugs-from-release-ta.md), [release tarball before/after fix, #12633](../learnings/1792152959615-reproduce-pre-fix-slang-behavior-with-release-tarb.md)). The binaries run with `LD_LIBRARY_PATH=<dir>/lib`, so a three-version bracket takes about two minutes ([#12768 release bracket](../learnings/1792154620818-12768-nested-swizzle-lvalue-did-work-on-v2024-1-34.md)). A wildcard pattern such as `--pattern "*linux-x86_64.tar.gz"` also selects the asset ([#12640 on v2026.19](../learnings/1792153782868-12640-interface-only-default-arg-crash-still-repro.md)).

You can also bisect without running anything. Fetch a source file at each tag and grep it: `gh api "repos/shader-slang/slang/contents/source/slang/hlsl.meta.slang?ref=v<tag>" -H "Accept: application/vnd.github.raw"` ([release tarball repro, #12634](../learnings/1792152922166-repro-version-specific-slangc-bugs-from-release-ta.md)).

Two examples show the before/after shape. For #12634, `Texture3D<float3>.SampleLevel` emits `tex3DLod<float3>` in v2026.14.1, v2026.15 and v2026.16, and NVRTC rejects it. v2026.17 and later emit `_slang_vector_reshape<float,3,float,4>(tex3DLod<float4>(...))`, and the PTX compiles (checked on v2026.19) ([#12634 bracket](../learnings/1792152922166-repro-version-specific-slangc-bugs-from-release-ta.md)). For #12633 (Texture2DMS on CUDA), v2026.16 emits the field with no type, and v2026.19 reports E55215 ([#12633 bracket](../learnings/1792152959615-reproduce-pre-fix-slang-behavior-with-release-tarb.md)).

## Choosing the version bracket and finding the fix commit

Test the version the reporter used and the latest release first ([fast CUDA/PTX triage with release binaries](../learnings/1792153192040-fast-gpu-free-build-repro-compare-slang-release-bi.md)). To bracket a fix, run `git log -- <test>` on a shallow clone to find the fix commit, then use `gh release list` dates to pick the release before it and the release after it ([release tarball before/after fix](../learnings/1792152959615-reproduce-pre-fix-slang-behavior-with-release-tarb.md)). To confirm that a fix PR shipped in a given release, check that it appears in the compare between two tags. The compare also finds the fix PR when you must not open the issue (in eval triage the issue's labels and state are the answer key): bracket the first good release with tarballs, then grep the window's commit subjects, which works in one call because bot PRs are titled "Fix #<n>: …": `gh api repos/shader-slang/slang/compare/v<bad>...v<good> --jq '.commits[] | .sha[0:10] + " " + (.commit.message | split("\n")[0])' | grep -i "<keyword>"`. For #12632 (CUDA half `SampleLevel` / `tex2DLod<__half4>`), v2026.16 was bad and v2026.16.1 good, and the compare named PR #12643, which added a `static_assert` diagnostic (E41400) ([find the fix PR without opening the issue](../learnings/1792304028705-find-the-fix-pr-for-an-issue-without-opening-the-i.md)). To name the *first* fixed release, test the first release after the fix merge date, not just a later one that happens to be fixed: #12988 was first recorded as shipping in v2026.18.3, but it is already in v2026.18.1 ([#12987 fix first ships in v2026.18.1](../learnings/1792403199630-12987-local-struct-conformance-fix-first-ships-in-.md)).

A release bracket narrows the search to a commit window, not to one commit. For #13273 the window between v2025.18.1 and v2025.18.2 held 19 commits, and two of them were plausible. Read each suspect's change to name the trigger ([#13273 release bisect](../learnings/1792159067590-13273-emit-fold-reorder-regressed-v2025-18-1-v2025.md)).

## CUDA/PTX triage with release binaries

`-target ptx` makes slangc call NVRTC, so a tarball gives a real CUDA compile check in a triage container with no build. NVRTC errors such as "dynamic initialization is not supported for a `__device__` variable" appear in seconds. For #12635 (nested static const arrays), v2026.14.1 fails and v2026.19 passes; PR #12688 fixed it ([fast CUDA/PTX triage with release binaries](../learnings/1792153192040-fast-gpu-free-build-repro-compare-slang-release-bi.md)). One atom says the tarball ships the NVRTC that slangc calls ([release tarball before/after fix](../learnings/1792152959615-reproduce-pre-fix-slang-behavior-with-release-tarb.md)). Another observed slangc using the container's NVRTC 12.6 at `/usr/local/cuda-12.6` ([fast CUDA/PTX triage](../learnings/1792153192040-fast-gpu-free-build-repro-compare-slang-release-bi.md)). Record which NVRTC version you ran when you quote a PTX result.

## Bisecting C++ API regressions with a linked repro

Compilation-API bugs (`loadModuleFromSource` and similar) do not need a source build either. Extract a tarball, then compile and link a tiny repro against it: `g++ -std=c++17 repro.cpp -I<X>/include -L<X>/lib -lslang-compiler -Wl,-rpath,$PWD/<X>/lib`. Use `-lslang` when the tarball has no `libslang-compiler.so`. Each version takes about a minute. For #12852 this showed that v2026.12.2 works, v2026.16.1 fails with "assert failure: slang-session.cpp(56): blob", and v2026.19 is fixed (PR #12853). That runtime evidence is stronger than "reproduced by code inspection" ([C++ API bisect by linking against release tarballs](../learnings/1792154932443-bisect-slang-c-api-regressions-by-linking-a-tiny-r.md)).

## Pitfalls: exit codes, hidden ICE text, and `-o -`

slangc can print an NVRTC error and still exit with code 0. Check that the output file exists, or grep stderr ([fast CUDA/PTX triage](../learnings/1792153192040-fast-gpu-free-build-repro-compare-slang-release-bi.md)).

Release builds do not print the ICE text that a debug build shows. The #12640 crash is a segfault with exit 139 and no message. Check `$?`, and do not trust empty output piped through `head`: the pipe hides the exit code, so read `${PIPESTATUS[0]}` ([#12640 on v2026.19](../learnings/1792153782868-12640-interface-only-default-arg-crash-still-repro.md)). A release binary also cannot tell you which phase crashed. #12640 segfaults with `-target none` and with `-skip-codegen` too, but IR lowering (`addDirectCallArgs`, `SLANG_ASSERT(argExpr)` in `slang-lower-to-ir.cpp`) still runs in both modes, so neither flag separates the checker from lowering. Use a debug build or a backtrace for that ([#12640 on v2026.20; -skip-codegen does not isolate the checker](../learnings/1792304859137-12640-still-segfaults-on-v2026-20-skip-codegen-doe.md); the same `-no-codegen` trap is on [Slang compiler crash triage](../concepts/misc-f0909b3-slang-compiler-crash-triage.md)).

Older slangc releases (v2025.1x) produce no output for `-o -`. In a cross-version bisect, write to a file such as `-o file.glsl`. If you do not, the old versions print nothing and get scored as failures ([#13273 release bisect, `-o -` gotcha](../learnings/1792159067590-13273-emit-fold-reorder-regressed-v2025-18-1-v2025.md)).

## Worked version matrices

**Status on v2026.20.** v2026.20 was tagged on 2026-10-17 at 04:17Z. Each row was re-checked on 2026-10-18 with the Linux release tarball; the older matrices follow the table.

| Issue | v2026.20 result | What to do next |
|---|---|---|
| #12640 interface-only default arg | Still exit 139 with no diagnostic on spirv, hlsl and cuda (also on v2026.14.1 and v2026.18.3). A call through a generic `T : IFoo` compiles and emits `Foo_func_0(1.0f)`, so the interface default is correct when the call stays on the requirement ([#12640 on v2026.20](../learnings/1792304859137-12640-still-segfaults-on-v2026-20-skip-codegen-doe.md)). | Still open. Find the crashing phase with a debug build (see Pitfalls). |
| #13011 optional-constraint ICE | Matrix unchanged from v2026.19: ICE for `__BuiltinFloatingPointType`, `IFloat`, `IInteger`; silent compile for `__BuiltinIntegerType` (#13061); E39999 for `IArithmetic`, `ILogical`, `__BuiltinLogicalType`. No PR references #13011 or #13061 ([#13011 on v2026.20](../learnings/1792306644966-slang-13011-optional-constraint-ice-still-on-v2026.md)). | Still open for a front-end fix in `isWitnessUncheckedOptional` or the inheritance linearization. |
| #13203 entry-point binding growth | Unchanged. With two compute entry points, the second one's uniforms follow the first's: SPIR-V bindings 0/1/2 then 3/4/5, HLSL b0/t0/u0 then b1/t1/u1. The user guide's own computeMain1/computeMain2 example gets b1/b2 in HLSL ([#13203 on v2026.20](../learnings/1792307527386-13203-entry-point-binding-growth-still-on-v2026-20.md)). | Mechanism and how to see the offset: [GPU lanes page](../concepts/slang-test-gpu-lanes-on-shared-l40s.md). |
| #13250 autodiff resource checkpoint | Compiles in 0.3 s at `-O0` and at the default `-O` (v2026.18.2 took more than 10 min), so a long timeout is no longer needed on v2026.20 or later. The SPIR-V defect remains: `SLANG_RUN_SPIRV_VALIDATION=1 ... -target spirv -profile spirv_1_3` reports `OpVariable %_ptr_Function__ptr_Uniform_RWStructuredBuffer Function` and slangc still exits 0; the output validates with `spirv_1_4`. On master, `canTypeBeStored` (`slang-ir-autodiff.cpp:993`) still returns true for struct and interface types without checking their fields ([#13250 on v2026.20](../learnings/1792307688947-slang-13250-repro-compiles-in-0-3-s-on-v2026-20-bu.md)). | Still open. |
| #13260 witness-synthesis receiver | Fixed. PR #13269 (`canBindFirstArgAsReceiver`) first ships in v2026.20: the repro compiles on SPIR-V, HLSL and CUDA, and HLSL calls `IHit_valuex24defaultImpl_0(Packed)`. v2026.19 still gives the SPIR-V ICE `slang-ir.cpp(5822): resultType` ([#13260 fix first ships in v2026.20](../learnings/1792307815208-13260-fix-pr-13269-first-ships-in-v2026-20.md)). | Verify with the v2026.20 tarball; a master build is no longer needed. |
| #13273 C-like emit fold reorder | Still wrong in GLSL, HLSL, Metal and WGSL; SPIR-V is right, and `-O0` does not hide the bug in GLSL. Fix PR #13283 merged on 2026-10-17 at 11:29Z, seven hours after the tag ([#13273 fix merged after v2026.20](../learnings/1792308017257-13273-fix-pr-13283-merged-after-v2026-20-v2026-20-.md)). | Confirm on the release after v2026.20, or on a master build. |

**#12640 (interface-only default argument).** The repro is `interface IFoo { void func(float A = 1.0); }` with an implementation `Foo::func(float A)` that has no default, called as `f.func()`. It segfaults (exit 139, no message) on v2026.14.1 and v2026.19 for both `-target spirv` and `-target cuda`. Master still has a plain `SLANG_ASSERT(argExpr)` in `addDirectCallArgs` (`slang-lower-to-ir.cpp` near line 4615). Three variants compile: an explicit argument, a call through a generic `T : IFoo`, and an implementation that has its own default ([#12640 still reproduces on v2026.19](../learnings/1792153782868-12640-interface-only-default-arg-crash-still-repro.md)).

**#12768 (nested swizzle lvalue).** The repro is `out.position.xyz.xyz = in.position.xyz;` compiled with `slangc -target glsl -stage vertex -entry vertexMain`. v2024.1.34 emits the correct `out_0.position_0.xyz = in_position_0.xyz;`. v2025.12.1 emits the broken `position_0[3] = vec3`; HLSL gives `[int(3)]` and SPIR-V gives `OpCompositeInsert %v4float %v3 %b 3`. v2026.19 is fixed by PR #12769 (merged 2026-09-01). So it is a true regression of working code. The bad `.add(elementCount)` line fits the 2024-11-15 `ShortList` refactor (05903f708) ([#12768 worked on v2024.1.34](../learnings/1792154620818-12768-nested-swizzle-lvalue-did-work-on-v2024-1-34.md)).

**#12987 (local-struct constrained-generic conformance).** The repro is a function-local `struct Op : IOp` with `apply<T : __BuiltinArithmeticType>`. It segfaults (rc=139) on v2026.17, v2026.17.1 and v2026.18 for spirv, hlsl and cuda ([#12987 crash matrix; #13092 is the generic variant](../learnings/1792156128422-12987-local-struct-constrained-generic-conformance.md)). The first fixed release is **v2026.18.1**, not v2026.18.3 as first recorded. The fix commit `b3aa9bec5` (PR #12988) merged on 2026-09-16, one day after v2026.18 (2026-09-15), so v2026.18.1 (2026-09-22) is the first release after it. v2026.18.1, v2026.19 and v2026.20 all compile the repro. The first check tested only v2026.18 (broken) and v2026.18.3 (fixed) and skipped .1 and .2. An "upgrade to X" reply must name the earliest fixed release: compare the fix merge date with `gh release list` dates and test the first release after the merge ([#12987 fix first ships in v2026.18.1](../learnings/1792403199630-12987-local-struct-conformance-fix-first-ships-in-.md)). If a report says it still fails on v2026.18.1 or later, check whether the local struct is generic (`Op<U>`): that is the separate bug #13092 (`lowerWitnessTable`), which #12988 does not fix.

**#13011 (optional-constraint ICE).** On v2026.19, `where optional T : X { return a + b; }` with `T` a struct behaves differently depending on `X`. `__BuiltinFloatingPointType`, `IFloat` and `IInteger` give ICE E99997 ("Unexpected context type for parameter info retrieval", in typeflow-specialize). `__BuiltinIntegerType` compiles silently to `a_0 + b_0` on a struct (#13061). `IArithmetic`, `ILogical` and `__BuiltinLogicalType` give the correct E39999. Use this matrix as the acceptance test set for a front-end fix of the optional-witness filter. `-target hlsl` and `-target spirv` both reproduce it with no GPU ([#13011 variant matrix on v2026.19](../learnings/1792156239266-slang-13011-optional-constraint-ice-variant-matrix.md)).

**#13273 (emit fold reorder).** The C-like emitter re-reads `s.top` after `s.top -= 1` in `s.a[s.top]`. v2025.18.1 is correct and v2025.18.2 is wrong. Of the 19 commits in that window, 54e1d02715 (#8619) is the trigger. It made `canAddressesPotentiallyAlias` (`slang-ir-util.cpp` near line 1472) treat same-root, different-field access chains as no-alias, so `processLoadUse` in `simplifyForEmit` now defers `load(gep)` past the store to `s.top`. That exposes an older bug: the emitter's fold check does not follow always-folded GEP/FieldAddress users. #8588, in the same window, only changes generic-parameter ordering. Fix PR #13283 merged after the v2026.20 tag (see the status table) ([#13273 release bisect](../learnings/1792159067590-13273-emit-fold-reorder-regressed-v2025-18-1-v2025.md)).

## Contradictions / supersessions

- #12768: an earlier learning called the bug a long-standing latent bug and "not a regression in the used-to-work sense". The release bracket corrects that: v2024.1.34 emits correct code, so it is a regression ([#12768 worked on v2024.1.34](../learnings/1792154620818-12768-nested-swizzle-lvalue-did-work-on-v2024-1-34.md)). The earlier learning stays live because it also holds the root-cause analysis (two defects in `visitSwizzleExpr`), which the bracket does not repeat.
- NVRTC source for `-target ptx`: one learning says the tarball ships NVRTC, another observed the container's NVRTC 12.6. Both are stated above. Neither has been checked against the other.

Related: [Slang build, binary-freshness, and shared-clone hazards](../concepts/slang-b-build-and-freshness.md) · [slangc CLI behavior: exit codes, crash semantics, output streams, and option propagation](../concepts/slang-tooling-f0909b0-slangc-cli-behavior.md)

**Source learnings (17):**
- [Repro version-specific slangc bugs from release tarballs; #12634 Texture3D SampleLevel bracket](../learnings/1792152922166-repro-version-specific-slangc-bugs-from-release-ta.md)
- [Reproduce pre-fix behavior with release tarballs; pick the bracket from the fix commit; #12633](../learnings/1792152959615-reproduce-pre-fix-slang-behavior-with-release-tarb.md)
- [Fast GPU-free CUDA/PTX triage with release binaries; NVRTC error with exit 0; #12635](../learnings/1792153192040-fast-gpu-free-build-repro-compare-slang-release-bi.md)
- [Bisect C++ API regressions by linking a tiny repro against release tarballs; #12852](../learnings/1792154932443-bisect-slang-c-api-regressions-by-linking-a-tiny-r.md)
- [#12640 interface-only default arg still segfaults on v2026.19; PIPESTATUS pitfall](../learnings/1792153782868-12640-interface-only-default-arg-crash-still-repro.md)
- [#12768 nested swizzle lvalue worked on v2024.1.34, broken on v2025.12.1](../learnings/1792154620818-12768-nested-swizzle-lvalue-did-work-on-v2024-1-34.md)
- [#12987 local-struct conformance crash matrix; #13092 is the generic variant](../learnings/1792156128422-12987-local-struct-constrained-generic-conformance.md)
- [#12987 fix first ships in v2026.18.1, not v2026.18.3; test the first release after the merge](../learnings/1792403199630-12987-local-struct-conformance-fix-first-ships-in-.md)
- [#13011 optional-constraint ICE variant matrix on v2026.19](../learnings/1792156239266-slang-13011-optional-constraint-ice-variant-matrix.md)
- [#13273 regressed v2025.18.1 to v2025.18.2 via #8619; old slangc ignores `-o -`](../learnings/1792159067590-13273-emit-fold-reorder-regressed-v2025-18-1-v2025.md)
- [Find the fix PR for an issue without opening the issue: release-tarball bisect + compare API; #12632](../learnings/1792304028705-find-the-fix-pr-for-an-issue-without-opening-the-i.md)
- [#12640 still segfaults on v2026.20; -skip-codegen does not isolate the checker](../learnings/1792304859137-12640-still-segfaults-on-v2026-20-skip-codegen-doe.md)
- [#13011 optional-constraint ICE still on v2026.20](../learnings/1792306644966-slang-13011-optional-constraint-ice-still-on-v2026.md)
- [#13203 entry-point binding growth still on v2026.20](../learnings/1792307527386-13203-entry-point-binding-growth-still-on-v2026-20.md)
- [#13250 repro compiles in 0.3 s on v2026.20 but still fails spirv-val](../learnings/1792307688947-slang-13250-repro-compiles-in-0-3-s-on-v2026-20-bu.md)
- [#13260 fix (PR #13269) first ships in v2026.20](../learnings/1792307815208-13260-fix-pr-13269-first-ships-in-v2026-20.md)
- [#13273 fix PR #13283 merged after v2026.20; v2026.20 still miscompiles](../learnings/1792308017257-13273-fix-pr-13283-merged-after-v2026-20-v2026-20-.md)

_Catalog: [[wiki/index.md]]_
