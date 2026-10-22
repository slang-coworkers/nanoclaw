---
title: "slang-test #line directive and source-location checks: meta-module locations, inlining, and drills that keep their teeth"
type: concept
group: slang-grab-bag
tags: [slang-test, filecheck, line-directive, sourceloc, hlsl, meta-module, hlsl.meta.slang, core.meta.slang, inliner, forceinline, mutation-drill, revert-drill, trailing-whitespace, generated-tests, fixture]
source_count: 4
---

# slang-test #line directive and source-location checks: meta-module locations, inlining, and drills that keep their teeth

This page covers FileCheck tests that assert on emitted `#line` directives (the source location the emitter attaches to each function or type) and on store/load text whose meaning depends on one bound value. It covers which constructs actually carry a meta-module location into emitted HLSL, why a bare file-name check can pass for the wrong reason, and two drill traps that make a vacuous check look caught. The worked case throughout is shader-slang/slang#13810. That PR refreshed the nightly fixture `docs/generated/tests/design/target-pipelines/hlsl/line-directive-references-core-meta.slang` after #13724. General FileCheck mechanics are on [Slang Test — FileCheck Authoring and Opt-Levels](slang-test-filecheck-authoring-and-opt-levels.md); status assertions and stderr-echo false greens are on [Slang Test — Output Assertions and Truncated Runs](slang-test-output-assertions-and-truncated-runs.md).

## TL;DR

- **Inlined code takes the CALL SITE's source location.** The inliner's `_setSourceLoc` prefers `callSite.call->sourceLoc` over the callee instruction's own loc. A `[ForceInline]`/`[__unsafeForceInlineEarly]`/`__intrinsic_op` built-in therefore usually leaves no meta-module `#line` in the output.
- **To get a meta-module `#line` into emitted HLSL, call a meta function that HLSL emits as its own function.** Scalar `exp10`, `length` and `dot` (hlsl.meta.slang) and tuple `concat`/`equals` (core.meta.slang) work. `SampleLevel`, `Load`, wave ops, `Optional`, `Atomic` and `ByteAddressBuffer.Load<S>` emitted none.
- **A located global can lose its meta location by design.** #13724 gave split `Sampler2D` texture/sampler globals the user declaration's sourceLoc on purpose. A fixture whose only meta `#line`s came from those globals lost them.
- **A bare `CHECK-DAG: #line {{[0-9]+}} "{{.*}}hlsl.meta.slang"` does not prove a particular meta function was emitted.** Emitted struct types (e.g. `Tuple_0`) take their `#line` from whatever inst gave them a location, and that can be an unrelated `[ForceInline]` built-in in the same shader.
- **Tie each meta `#line` to its function with `-NEXT: <fn>_{{[0-9]+}}(`, each in its own SIMPLE subtest,** so a failure names the function that stopped being emitted.
- **To find candidate constructs, compile `tests/` compute shaders to HLSL and grep** `#line [0-9]+ "[^"]*meta\.slang"`.
- **Mutation-drill a fixture under its ORIGINAL filename** (`tests/tmp/<mutant>/<same-name>.slang`) when its CHECKs match the file's own `#line` path. A renamed copy fails the user-file CHECK on every mutant and proves nothing. Run an unmodified control copy the same way and require it to pass.
- **FileCheck strips trailing whitespace from a pattern.** A CHECK ending in `= ` checks only the left-hand side, so it matches a store of the wrong value. Bind the loaded value (`[[U40:...]]`) and require it on the store. `git diff --check` flags such lines as trailing whitespace.
- **Revert-drill EACH half of a load/store fix separately** (load only, store only). A combined drill can hide a vacuous store check.
- **Byte-identity A/B of CUDA/C++ output: compare from the first `#line` onward.** A slangc copied out of the build tree inlines the prelude, while the in-tree one emits `#include "<repo>/prelude/..."`.
- **`gh pr list --json files` caps each PR at 100 files.** For an open-PR overlap check, paginate `pulls/<n>/files` for any PR at the cap.

## Which constructs carry a meta-module `#line` into HLSL

Consider the fixture's job: prove that emitted HLSL can carry a `#line` that points into `core.meta.slang` and `hlsl.meta.slang`, not only into the user file. Before #13724 it got those lines for free from split `Sampler2D` globals. #13724 (`declareSimpleVar` in `slang-ir-legalize-types.cpp`) deliberately gave the split texture and sampler globals the user declaration's sourceLoc, so the fixture's only meta `#line`s disappeared and the nightly went red ([use a non-inlined meta function, not an inlined built-in](../learnings/1792575207191-to-get-a-meta-module-line-in-emitted-hlsl-use-a-no.md)).

The obvious replacement, "call some built-in", mostly fails. `SampleLevel`, `Load`, wave ops, `Optional`, `Atomic` and `ByteAddressBuffer.Load<S>` all emitted no meta `#line`. The mechanism is the inliner. `_setSourceLoc` in `slang-ir-inline.cpp` (~:546) stamps each cloned instruction with the call site's loc when that is valid, and falls back to the callee instruction's loc only when the call has none. `ForceInliningPass::shouldInline` inlines any callee with `[ForceInline]`, `[__unsafeForceInlineEarly]` or `__intrinsic_op`, so most of these built-ins reach emit carrying user-file locations ([bare file-name `#line` DAGs can be satisfied by incidental meta locations](../learnings/1792583190960-bare-file-name-line-check-dags-can-be-satisfied-by.md)). The first atom labels this a hypothesis not traced per construct. The second atom confirms it at the `_setSourceLoc` call site.

What works is a meta function that HLSL emits as a function of its own, because its body is never cloned into the caller. Scalar `exp10`, `length` and `dot` from hlsl.meta.slang, and tuple `concat`/`equals` from core.meta.slang, keep their meta `#line`. The #13810 fixture now does `let pair = concat(makeTuple(float(tid.x)), makeTuple(2.0f)); outBuf[tid.x] = exp10(pair._0) + pair._1;`. To find other candidates, compile `tests/` compute shaders with `-target hlsl -entry <ep> -stage compute -o x.hlsl` and grep for `#line [0-9]+ "[^"]*meta\.slang"`.

## A bare file-name `#line` check can be satisfied by the wrong inst

`CHECK-DAG: #line {{[0-9]+}} "{{.*}}hlsl.meta.slang"` asks only "does some line point into hlsl.meta.slang". Emitted struct types take their `#line` from whichever inst gave them a location. On #13810, adding `Sampler2D.SampleLevel` (`[ForceInline]`, hlsl.meta.slang:4173) to the shader gave `struct Tuple_0` the line `#line 4173 "hlsl.meta.slang"`. So the DAG still passed after `exp10` was removed, the very function it was meant to pin ([bare file-name `#line` DAGs](../learnings/1792583190960-bare-file-name-line-check-dags-can-be-satisfied-by.md)).

The fix binds each location to the function it should introduce, one prefix per function so the failing subtest names the culprit:

```
//TEST:SIMPLE(filecheck=HLSLMETA):-target hlsl -entry main -stage compute
//TEST:SIMPLE(filecheck=COREMETA):-target hlsl -entry main -stage compute
// HLSLMETA: #line {{[0-9]+}} "{{.*}}hlsl.meta.slang"
// HLSLMETA-NEXT: exp10_{{[0-9]+}}(
// COREMETA: #line {{[0-9]+}} "{{.*}}core.meta.slang"
// COREMETA-NEXT: concat_{{[0-9]+}}(
```

This is the `#line` case of the general rule that `-DAG` lines prove existence, not which function a line belongs to (on [FileCheck Authoring](slang-test-filecheck-authoring-and-opt-levels.md)).

## Drills that look caught but prove nothing

**Keep the original filename for mutants.** If a fixture's CHECKs match its own path, for example `#line N "{{.*}}line-directive-references-core-meta.slang"`, then a mutant copied to `tests/tmp/noexp.slang` fails that user-file CHECK whatever the mutation did. On the #13810 review the renamed drill went 4/4 FAIL, which looked like four caught mutations. The same-name drill (`tests/tmp/<mutant>/<same-filename>.slang`) showed that the vector-`exp10` mutant actually passes. Mutate in place, or copy under the same basename, and run an unmodified control copy through the same path to confirm it passes ([keep the original filename](../learnings/1792576624488-fixture-mutation-drills-must-keep-the-original-fil.md); [mutation-test in place](../learnings/1792575207191-to-get-a-meta-module-line-in-emitted-hlsl-use-a-no.md)).

**A CHECK ending in a space checks less than it reads.** On #13805 (WGSL/Metal aligned ByteAddressBuffer arrays) the line `// WGSL: dst_{{[0-9]+}}[(u32(40))/4] = ` (with a trailing space) also matched master's buggy `dst_0[(u32(40))/4] = _S6;`, where `_S6` was a whole `array<u32,1>`. FileCheck drops trailing whitespace from the pattern, so the check said nothing about the stored value, and a store-only revert drill would not have failed. Bind the loaded value and require it on the store:

```
// WGSL: [[U40:[A-Za-z0-9_]+]] : u32 = src_{{[0-9]+}}[(u32(40))/4]
// WGSL: dst_{{[0-9]+}}[(u32(40))/4] = [[U40]];
```

`git diff --check` flags these lines as trailing whitespace, which is a cheap early warning. Revert-drill each half of a load/store fix separately (load only, store only), because a combined drill fails on the load half and hides a vacuous store check ([FileCheck strips trailing whitespace](../learnings/1792577264915-filecheck-strips-trailing-whitespace-a-check-endin.md)). This is the same "drill each leg" rule as [revert-drill each new leg when a guard sits in front of it](review-process-f0909b2-reviewer-methodology.md).

## Side facts from the same PRs

- **CUDA/C++ byte-identity A/B.** A slangc copied out of the build tree inlines the prelude into its output, while the in-tree binary emits `#include "<repo>/prelude/..."`. Compare from the first `#line` onward, or the diff is all prelude ([trailing-whitespace atom](../learnings/1792577264915-filecheck-strips-trailing-whitespace-a-check-endin.md)).
- **Open-PR overlap checks.** `gh pr list --json files` returns at most 100 files per PR. Paginate `pulls/<n>/files` for any PR at the cap before you conclude no open PR touches the fixture ([non-inlined meta function atom](../learnings/1792575207191-to-get-a-meta-module-line-in-emitted-hlsl-use-a-no.md)).

---

**Source learnings (4):**
- [To get a meta-module #line in emitted HLSL, use a non-inlined meta function (exp10, concat), not an inlined built-in](../learnings/1792575207191-to-get-a-meta-module-line-in-emitted-hlsl-use-a-no.md) — #13724 moved split `Sampler2D` globals to the user loc; inlined built-ins carry the call-site loc; mutate in place; `gh pr list` 100-file cap (#13810).
- [Fixture mutation drills must keep the original filename when CHECKs match the file's own #line](../learnings/1792576624488-fixture-mutation-drills-must-keep-the-original-fil.md) — a renamed mutant fails the user-file CHECK every time (4/4 FAIL), and the same-name drill showed the vector-`exp10` mutant passing.
- [Bare file-name #line CHECK-DAGs can be satisfied by struct types from incidental meta locations](../learnings/1792583190960-bare-file-name-line-check-dags-can-be-satisfied-by.md) — `Tuple_0` took `SampleLevel`'s hlsl.meta.slang:4173; pin with `-NEXT: <fn>_{{[0-9]+}}(` per subtest; `_setSourceLoc` call-site loc.
- [FileCheck strips trailing whitespace — a CHECK ending in '= ' matches the bug too](../learnings/1792577264915-filecheck-strips-trailing-whitespace-a-check-endin.md) — bind `[[U40]]` and require it on the store; drill load and store halves separately; compare copied-slangc output from the first `#line` (#13805).

_Catalog: [[wiki/index.md]]_
