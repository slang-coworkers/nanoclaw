---
title: "Worked Slang release version matrices: per-issue status across releases"
type: concept
group: slang-tooling
tags: [slang, release-tarball, version-matrix, regression, first-fixed-release, workaround, triage, status-table]
source_count: 18
---

# Worked Slang release version matrices: per-issue status across releases

These are the worked results of the release-tarball method on [Reproducing version-specific Slang bugs with release tarballs](slang-tooling-release-tarball-repro-and-version-bisect.md): a status table for open issues on v2026.20 and the per-issue brackets behind it. Each row records which releases are good and bad, the fix PR when there is one, and the reply or workaround to give a reporter.

## TL;DR

- Keep one status row per open issue: the result on the latest release, the next action, and a verified workaround. Re-check every row on each new release.
- An "upgrade to X" reply names the earliest fixed release. Sampling only two releases recorded v2026.18.3 for #12987, but the first fixed release is v2026.18.1.
- A fix merged after the tag's time is not in that release, even on the same day (#13273: merged seven hours after v2026.20). Say "fixed on master, not in vX".
- A failure on the fixed release or later is probably a separate variant (#12987 vs the generic local struct #13092).
- A variant matrix on one release (#13011: which constraint gives ICE, silent miscompile or the right diagnostic) is the acceptance test set for a fix.
- A bracket with an old release giving the correct output makes a "latent" bug a regression (#12768 on v2024.1.34).
- After a bracket, read the window's commits and name the trigger (#13273: #8619 out of 19 commits).

## Status on v2026.20 and worked brackets

**Status on v2026.20** (tagged 2026-10-17 04:17Z), re-checked 2026-10-18 on the Linux tarball; some rows add a 2026-10-19 master re-check and a verified workaround.

| Issue | v2026.20 result | Next |
|---|---|---|
| #12640 interface-only default arg | Still exit 139, no diagnostic, on spirv/hlsl/cuda (also v2026.14.1, v2026.18.3) ([#12640 v2026.20](../learnings/1792304859137-12640-still-segfaults-on-v2026-20-skip-codegen-doe.md)). | Open. Find the crashing phase with a debug build. |
| #13011 optional-constraint ICE | v2026.19 matrix (below) unchanged; no PR references #13011 or #13061 ([#13011 v2026.20](../learnings/1792306644966-slang-13011-optional-constraint-ice-still-on-v2026.md)). | Open. Give reporters the `if (T is X)` workaround. |
| #13203 entry-point binding growth | Unchanged: the second compute entry point's uniforms follow the first's (SPIR-V 0/1/2 then 3/4/5; HLSL b0/t0/u0 then b1/t1/u1); the user guide's computeMain1/computeMain2 example gets b1/b2 in HLSL ([#13203 v2026.20](../learnings/1792307527386-13203-entry-point-binding-growth-still-on-v2026-20.md)). | Mechanism: [GPU lanes page](../concepts/slang-test-gpu-lanes-on-shared-l40s.md). |
| #13250 autodiff resource checkpoint | Compiles in 0.3 s at `-O0` and `-O` (v2026.18.2: >10 min), but `-profile spirv_1_3` validation still reports `OpVariable %_ptr_Function__ptr_Uniform_RWStructuredBuffer Function` while slangc exits 0; master `canTypeBeStored` (`slang-ir-autodiff.cpp`) returns true for struct/interface types without checking fields ([#13250 v2026.20](../learnings/1792307688947-slang-13250-repro-compiles-in-0-3-s-on-v2026-20-bu.md)). The default profile (SPIR-V 1.5) and `spirv_1_4` validate ([default 1.5](../learnings/1792404676930-slang-13250-default-spir-v-profile-1-5-validates-o.md)); generic `T : ITensor` or `[PreferRecompute]` rewrites do not help ([no source workaround](../learnings/1792426092425-slang-13250-source-level-workarounds-that-do-not-f.md)). | Open. Workaround: `-profile spirv_1_4` or the default. |
| #13260 witness-synthesis receiver | Fixed: PR #13269 (`canBindFirstArgAsReceiver`) first ships in v2026.20 (SPIR-V/HLSL/CUDA compile; HLSL calls `IHit_valuex24defaultImpl_0(Packed)`); v2026.19 still ICEs `slang-ir.cpp(5822): resultType` ([#13260](../learnings/1792307815208-13260-fix-pr-13269-first-ships-in-v2026-20.md)). | Verify on the v2026.20 tarball. |
| #13273 C-like emit fold reorder | Wrong in GLSL/HLSL/Metal/WGSL, right in SPIR-V; `-O0` does not hide it in GLSL. Fix PR #13283 merged 2026-10-17 11:29Z, seven hours after the tag ([#13273 after v2026.20](../learnings/1792308017257-13273-fix-pr-13283-merged-after-v2026-20-v2026-20-.md)). Master 68438b5e1 is right on all four (`int _S1 = s.top;` before `s.top -= 1`, indexes `a[_S1]`; the `handle` re-read of `frames[top]` is fixed too); v2026.18.3 is wrong on the same four ([#13273 master](../learnings/1792426436559-13273-master-build-confirms-fix-emits-int-s1-s-top.md)). | Reply: fixed on master, not in v2026.20; use a workaround or SPIR-V until the next release, then re-check. |
| #13548 `NonUniformResourceIndex` swap | Wrong on HLSL/GLSL/CUDA/C++. PR #13283 also closes it (adds `tests/bugs/gh-13548.slang`); master emits `uint _S1 = b_0; uint _S2 = a_0; a_0 = NonUniformResourceIndex(_S1); ...` ([#13548](../learnings/1792406922339-13548-nonuniformresourceindex-swap-miscompile-fixe.md)). | Workaround: `t[NonUniformResourceIndex(a)]` at the resource index; copying to locals does not help. Mechanism: [[wiki/concepts/slang-b-bindings-and-backends.md]]. |

**#12640 (interface-only default argument).** `interface IFoo { void func(float A = 1.0); }`, implemented by `Foo::func(float A)` with no default and called as `f.func()`, segfaults (exit 139, no message) on v2026.14.1 and v2026.19 for spirv and cuda; master still has a plain `SLANG_ASSERT(argExpr)` in `addDirectCallArgs` (`slang-lower-to-ir.cpp` near line 4615). An explicit argument, an implementation with its own default, and a call through a generic `T : IFoo` all compile ([#12640 v2026.19](../learnings/1792153782868-12640-interface-only-default-arg-crash-still-repro.md)); on v2026.20 the generic call emits `Foo_func_0(1.0f)`, so the default is right when the call stays on the requirement ([#12640 v2026.20](../learnings/1792304859137-12640-still-segfaults-on-v2026-20-skip-codegen-doe.md)).

**#12768 (nested swizzle lvalue).** `out.position.xyz.xyz = in.position.xyz;` (`-target glsl -stage vertex -entry vertexMain`): v2024.1.34 emits the correct `out_0.position_0.xyz = in_position_0.xyz;`; v2025.12.1 emits `position_0[3] = vec3` (HLSL `[int(3)]`, SPIR-V `OpCompositeInsert %v4float %v3 %b 3`); v2026.19 is fixed by PR #12769 (merged 2026-09-01). It is a true regression; the bad `.add(elementCount)` line fits the 2024-11-15 `ShortList` refactor (05903f708) ([#12768](../learnings/1792154620818-12768-nested-swizzle-lvalue-did-work-on-v2024-1-34.md)).

**#12987 (local-struct constrained-generic conformance).** A function-local `struct Op : IOp` with `apply<T : __BuiltinArithmeticType>` segfaults (rc=139) on v2026.17, v2026.17.1 and v2026.18 for spirv, hlsl and cuda. The first fixed release is **v2026.18.1**, not the v2026.18.3 first recorded from sampling only v2026.18 and v2026.18.3: fix `b3aa9bec5` (PR #12988) merged 2026-09-16, a day after v2026.18, and v2026.18.1, v2026.19 and v2026.20 compile it. An "upgrade to X" reply must name the earliest fixed release ([#12987 in v2026.18.1](../learnings/1792403199630-12987-local-struct-conformance-fix-first-ships-in-.md)). If it still fails on v2026.18.1+, check whether the local struct is generic (`Op<U>`): that is the separate bug #13092 (`lowerWitnessTable`), which #12988 does not fix ([two-stage crash](../learnings/1789483742996-function-local-interface-conformance-crashes-at-tw.md)).

**#13011 (optional-constraint ICE).** On v2026.19, `where optional T : X { return a + b; }` with `T` a struct depends on `X`: `__BuiltinFloatingPointType`, `IFloat`, `IInteger` give ICE E99997 ("Unexpected context type for parameter info retrieval", typeflow-specialize); `__BuiltinIntegerType` compiles silently to `a_0 + b_0` on a struct (#13061); `IArithmetic`, `ILogical`, `__BuiltinLogicalType` give the correct E39999. `-target hlsl` and `spirv` reproduce it with no GPU; the matrix is the acceptance set for a front-end fix ([#13011 matrix](../learnings/1792156239266-slang-13011-optional-constraint-ice-variant-matrix.md)). Master 68438b5e1 (2026-10-19) gives the same matrix; the maintainer placed the fix in the front-end lookup filter for optional constraints (`isWitnessUncheckedOptional`, `slang-check-expr.cpp:1344`), not a typeflow guard ([#13011 direction](../learnings/1792424334332-slang-13011-maintainer-direction-filter-lookups-re.md)). Until then `if (T is __BuiltinFloatingPointType) return a + b; return a;` compiles on v2026.20 for float and struct instantiations (HLSL `a_0 + b_0` for float, `return a_1` for the struct) ([#13011 workaround](../learnings/1792403257595-slang-13011-optional-constraint-ice-if-t-is-x-guar.md)).

**#13273 (emit fold reorder).** The C-like emitter re-reads `s.top` after `s.top -= 1` in `s.a[s.top]`; v2025.18.1 is right, v2025.18.2 wrong. Of the window's 19 commits, 54e1d02715 (#8619) is the trigger: it made `canAddressesPotentiallyAlias` (`slang-ir-util.cpp` ~1472) treat same-root, different-field access chains as no-alias, so `processLoadUse` in `simplifyForEmit` defers `load(gep)` past the store. That exposes an older bug: the emitter's fold check does not follow always-folded GEP/FieldAddress users (#8588, same window, only reorders generic parameters). Fix PR #13283 merged after the v2026.20 tag ([#13273 bisect](../learnings/1792159067590-13273-emit-fold-reorder-regressed-v2025-18-1-v2025.md)).

## Contradictions / supersessions

- #12768: an earlier learning called it latent, "not a regression in the used-to-work sense"; the bracket shows v2024.1.34 correct, so it is one ([#12768](../learnings/1792154620818-12768-nested-swizzle-lvalue-did-work-on-v2024-1-34.md)). The earlier learning stays for its root cause (two defects in `visitSwizzleExpr`).

**Source learnings (18):**
- [#12640 still segfaults on v2026.19; PIPESTATUS](../learnings/1792153782868-12640-interface-only-default-arg-crash-still-repro.md)
- [#12768 worked on v2024.1.34, broken on v2025.12.1](../learnings/1792154620818-12768-nested-swizzle-lvalue-did-work-on-v2024-1-34.md)
- [Local conformance crashes at two stages (#12987 vs #13092)](../learnings/1789483742996-function-local-interface-conformance-crashes-at-tw.md)
- [#12987 fix first ships in v2026.18.1](../learnings/1792403199630-12987-local-struct-conformance-fix-first-ships-in-.md)
- [#13011 variant matrix on v2026.19](../learnings/1792156239266-slang-13011-optional-constraint-ice-variant-matrix.md)
- [#13273 regressed via #8619; old slangc ignores `-o -`](../learnings/1792159067590-13273-emit-fold-reorder-regressed-v2025-18-1-v2025.md)
- [#12640 on v2026.20; -skip-codegen does not isolate the checker](../learnings/1792304859137-12640-still-segfaults-on-v2026-20-skip-codegen-doe.md)
- [#13011 still on v2026.20](../learnings/1792306644966-slang-13011-optional-constraint-ice-still-on-v2026.md)
- [#13203 binding growth still on v2026.20](../learnings/1792307527386-13203-entry-point-binding-growth-still-on-v2026-20.md)
- [#13250 compiles in 0.3 s on v2026.20, still fails spirv-val](../learnings/1792307688947-slang-13250-repro-compiles-in-0-3-s-on-v2026-20-bu.md)
- [#13250: default SPIR-V 1.5 validates](../learnings/1792404676930-slang-13250-default-spir-v-profile-1-5-validates-o.md)
- [#13250: source workarounds that do not fix it](../learnings/1792426092425-slang-13250-source-level-workarounds-that-do-not-f.md)
- [#13260 fix first ships in v2026.20](../learnings/1792307815208-13260-fix-pr-13269-first-ships-in-v2026-20.md)
- [#13273 fix merged after v2026.20](../learnings/1792308017257-13273-fix-pr-13283-merged-after-v2026-20-v2026-20-.md)
- [#13011 `if (T is X)` workaround](../learnings/1792403257595-slang-13011-optional-constraint-ice-if-t-is-x-guar.md)
- [#13011 maintainer direction](../learnings/1792424334332-slang-13011-maintainer-direction-filter-lookups-re.md)
- [#13273 master build confirms fix](../learnings/1792426436559-13273-master-build-confirms-fix-emits-int-s1-s-top.md)
- [#13548 fixed by #13283; index-site workaround](../learnings/1792406922339-13548-nonuniformresourceindex-swap-miscompile-fixe.md)

_Catalog: [[wiki/index.md]]_
