---
title: "docs/generated nightly agentic suite: harness-rule fallout, building the fix set, and masked failures"
type: concept
group: slang-tooling
tags: [slang-test, docs-generated, nightly, agentic-tests, exit-code, filecheck, triage, spirv-validation]
source_count: 9
---

## TL;DR

- **Since #14269 (2026-11-04) a `SIMPLE(filecheck=X)` lane fails on a non-zero slangc exit
  unless it says `exit-code=N`**, even when every CHECK matches. `diag=` lanes are not checked
  yet (#14266); REFLECTION and INTERPRET got the same check in #14299.
- **A harness-rule PR that sweeps only `tests/` breaks the nightly.** `docs/generated/tests/**`
  runs only in the nightly agentic-tests job (not PR CI, not the merge queue), so the break
  appears the next night (80 fixtures on 2026-11-05). Grep `docs/generated/tests/` too.
- **Branches cut before a harness rule break on merge with master**, even when the merge is clean.
- **Build the fix set from `FAILED test:` lines, not from the error message.** Fixtures on
  `_meta/expected-failures.txt` print the same message but count as "failed expectedly".
- **An exit-code-only failure prints no tool output.** "No E99999 in the CI log" proves
  nothing. Read `<fixture>[.N].actual`, or rerun the fixture locally with the nightly env.
- **Local repro matches CI exactly** in about 80-100 s on an incremental Release build:
  `SLANG_RUN_SPIRV_VALIDATION=1 SLANG_DISABLE_AVX512=1 slang-test -test-dir docs/generated/tests -use-test-server -server-count 4 -expected-failure-list docs/generated/tests/_meta/expected-failures.txt`.
- **A blanket `exit-code=-1` masks real failures.** Of 80 broken fixtures, 58 were intended
  diagnostics and about 22 were IR-dump/codegen tests that never compiled for unintended reasons.
- **SPIR-V validation failures exit -1, not -2.** The #14303 internal-error exit code does not
  cover `Validation of generated SPIR-V failed`.
- **A docs-only PR gets a green ci.yml with every build/test job skipped.** That green verifies
  nothing; say so in a review request or report.
- **A fixture sweep must also fix the generator prompts**, or regeneration brings the failures
  back (see the generated-docs page).
- **A Nightly Coverage red can be the sibling Pages size budget**, not code.

## The #14269 exit-code rule and the 80-fixture nightly break

Consider a fixture that checks the diagnostic of a compile that fails on purpose:

```slang
//DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK):-target spirv
// CHECK: [E30015]
```

Before d6ad99cb3 (#14269, 2026-11-04) this lane passed, because SIMPLE+FileCheck never read
`result code` (the older behavior and the result-code pins it needed are on
[the output-assertions page](slang-test-output-assertions-and-truncated-runs.md)). Since then
it fails with `expected exit code 0, but the exit code is -1` even though every CHECK matches,
and it must say `(filecheck=CHECK,exit-code=-1)`. `diag=` lanes are not checked yet (#14266);
REFLECTION and INTERPRET got the same check in #14299. A branch cut before 11-04 that adds such
a lane breaks on merge with master even though the merge itself is clean
[#14269 exit-code rule](../learnings/1793897749447-slang-test-now-fails-filecheck-simple-tests-on-non.md).
The PR's own sweep covered `tests/` only. The nightly-only `docs/generated/tests/**` tree (the
agentic-tests job of `nightly-slang-test.yml`) then failed 80 fixtures on 2026-11-05 (run
41965949020, tracked as #14338). We triage such a break by taking the nightly's `FAILED test:`
set, grouping it by the `expected exit code` message, and comparing it with the previous green
nightly and the PRs merged in between; the prevention is to grep `docs/generated/tests/` as
well before merging any harness-rule PR
[#14269 staled 80 nightly fixtures](../learnings/1793866079028-slang-test-exit-code-rule-14269-staled-80-nightly-.md)
[blanket exit-code=N masks ~22 real failures](../learnings/1793866828932-docs-generated-nightly-exit-code-break-after-slang.md).

## Building the fix set: intersect with `FAILED test:` lines

A grep for `expected exit code ... is N` over the nightly log also catches fixtures listed in
`docs/generated/tests/_meta/expected-failures.txt`. They print the same message, but slang-test
tallies them as "failed expectedly" and they do not break the run. On #14338, 89 messages
covered only 80 unexpected FAILED ids; the 9 extra rows (7 files) were tracked bugs, and adding
`exit-code=` to them would hide the real failure (for example a slangi VM matrix swizzle out of
bounds). The fix set is the intersection with the `FAILED test: '...'` lines. Many of the 80
were `-dump-ir` fixtures that expect success but always failed with a real diagnostic (for
example E31211 for an implicit-LOD `Sample` in compute); #14269 only exposed them, and they are
not intended-failure tests. A side trap from the same triage: `gh pr view --json files` caps at
100 files, so #14269 looked like 101 files but had 358; page the REST `pulls/N/files` endpoint
instead
[fixture lists include expected-failure rows](../learnings/1793866800949-release-regression-fixture-lists-for-docs-generate.md).

## Reading an exit-code-only failure

A test that fails only on its exit code logs just `expected exit code 0, but the exit code is
N`, with no tool stdout or stderr. On #14338 the nightly log had 0 hits for E99999, yet a local
run of the same fixtures with `SLANG_RUN_SPIRV_VALIDATION=1` showed 7 ×
`internal error[E99999]: Validation of generated SPIR-V failed`. Those exit -1, not -2, because
the #14303 internal-error exit code does not cover SPIR-V validation
[exit-code-only failures print no tool output](../learnings/1793866967333-slang-test-exit-code-only-failures-print-no-tool-o.md).
The output is still on disk: slang-test writes `<fixture>[.N].actual` (gitignored) next to every
failing fixture, including exit-code-only failures, where N counts the `//TEST` and
`//DIAGNOSTIC_TEST` lines of the file in order. Diffing each `.actual` against its directive's
CHECK prefix is the fast way to separate an intended diagnostic from a masked failure (#14338:
58 intended, 22 not). Two caveats: spirv-val's own message is not in `.actual` (rerun slangc
without `-dump-ir` to see it), and a grep for "assert" matches the IR's `StaticAssert`
[.actual files hold the full output](../learnings/1793870186670-docs-only-prs-skip-every-build-test-job-in-ci-yml-.md).
The nightly command in the TL;DR (env `SLANG_RUN_SPIRV_VALIDATION=1 SLANG_DISABLE_AVX512=1`)
reproduced all 89 mismatches (80 unexpected + 9 expected) in about 100 s with server-count 4,
and about 80 s with server-count 16. The `-test-dir` form does run the tests (a bare directory
prefix does not; see the generated-docs page). Each failure also prints "retry never produced a
verdict" under `-use-test-server`; that line is harmless reporting noise
[local repro and .actual tip](../learnings/1793866828932-docs-generated-nightly-exit-code-break-after-slang.md).

## Docs-only PRs: a green ci.yml verifies nothing

A shader-slang/slang PR that touches only `docs/generated/**` gets a green ci.yml run in which
only `filter` and `check-ci` ran; the filter sets `should-run=false` and all 44 build/test jobs
are skipped. Because the agentic suite runs only in the nightly, "CI success" on such a PR
tests none of its fixtures. Run the nightly command locally and state in the review request
that CI did not exercise the change
[docs-only PRs skip every build/test job](../learnings/1793870186670-docs-only-prs-skip-every-build-test-job-in-ci-yml-.md).

## What the masked failures were

About 22 of the 80 broken fixtures check IR text or codegen (no diagnostic) and fail to compile
for unintended reasons: 7 only under SPIR-V validation (negative index literal, SeqCst
atomics, sampler type, missing capability, `OpTypeRuntimeArray` variable), 8 with E31211
derivative-group thread count (texture `Sample` in compute), 3 with E38207 global generic
parameter, and single E55201/E50100/E39999/E30015 cases
[blanket exit-code=N masks ~22 real failures](../learnings/1793866828932-docs-generated-nightly-exit-code-break-after-slang.md).

Some are compiler bugs. Checked at master 04d2726db with `SLANG_RUN_SPIRV_VALIDATION=1`, four
causes cover the 7 ir-reference E99999 fixtures
[E99999 triage of 7 ir-reference fixtures](../learnings/1793867580734-doc-test-e99999-triage-4-of-7-ir-reference-fixture.md):
- A negative constant index into a `RWStructuredBuffer` (`rwbuf[-1]`, `Load(-1)`, or `int i=-1;
  rwbuf[i]` after folding) emits `OpAccessChain ... %int_n1`, which spirv-val rejects ("Index at
  word 5 may not have a negative value", a Logical-addressing rule). `OutOfBoundAccessChecker`
  (`slang-check-out-of-bound-access.cpp:22-47`) gives E30029 for sized arrays only and never
  looks at the RWStructuredBuffer / `StructuredBufferLoad` ops. No upstream issue as of 2026-11-05.
- SeqCst atomics hit VUID-10866 even with `-capability vk_mem_model` (#13519).
- `uniform float tail[]` at global scope or as an entry-point uniform gives VUID-04680 ("Cannot
  load a runtime-sized array"); E31215 (`slang-check-decl.cpp:4014`) covers only an explicit
  `ConstantBuffer<T>` (#13530).
- The `spirv_asm` path infers no capabilities for `OpExecutionMode` or for `builtin(...)`
  variables (`getBuiltinGlobalVar`), and the `-capability spvXxx` atoms never emit
  `OpCapability`. The fixture must write `OpCapability` in the block, as `a1-04-interop.md` and
  `hlsl.meta.slang:18375` do; these fixtures are invalid input, not a compiler bug.

Others are invalid inputs. A triage of 15 failing fixtures at the same commit found them all
invalid
[common invalid-input patterns](../learnings/1793867764880-docs-generated-agentic-fixtures-common-invalid-inp.md):
- `[numthreads(1,1,1)]` compute plus implicit-LOD `Sample`/`SampleCmp` on SPIR-V gives E31211.
  Since #13371, Y==1 infers the Linear derivative group, which needs x*y*z % 4 == 0. Use
  `SampleLevel`/`SampleCmpLevelZero` or `numthreads(4,1,1)`.
- slangc `-specialize` appends its args to the LAST `-entry` only (`slang-options.cpp:4115`) and
  cannot bind a global `type_param`: after `-entry` it gives E38025; before it, the flag is
  dropped silently and the compile gives E38207. `docs/language-guide.md:168` wrongly says it
  can. Global args are set only through the API (`setGlobalGenericArgs` /
  `IComponentType::specialize`).
- GLSL names (`vec3`) need `-lang glsl` placed BEFORE the input file (it is positional), a
  `.glsl` extension, or `import glsl;`. `-target glsl` alone does not make them available.
- Side bugs found on the way: recursion with `-target cpp` crashes with "circularity during
  codegen" (`slang-emit-c-like.cpp:5487` requires a call's callee at Definition level), and
  `IFoo t = {}` plus dynamic dispatch plus `-conformance Impl:IFoo` still crashes in spirv-emit
  after #12518.

## Fixing the fixtures without masking

The principled fix is per lane: add `exit-code=-1` only where the diagnostic is the intended
result, fix the invalid inputs, and move compiler-bug fixtures to `_meta/expected-failures.txt`
under a `#` comment with an issue link. #14343 took this route for 58 fixtures. A mechanical
sweep is incomplete until the generator prompts (`_meta/prompts/_common.md` and the bundle's
`_prompt.md`) stop prescribing the old shape; the rule and its precedents are on
[the generated-docs page](slang-tooling-f0909b0-markdown-generated-docs.md), and the CHECK-DAG
pin trap from the same PR is on
[the test-authoring page](slang-tooling-f0909b0-test-authoring-filecheck.md)
[sweeps must also fix the generator prompts](../learnings/1793872226026-docs-generated-fixture-sweeps-must-also-fix-the-ge.md).

A red **Nightly Coverage** run in the same window can be the sibling repo
slang-coverage-reports failing its Pages deploy with `Pages size budget exceeded` (950 MB),
which is not a code failure
[#14269 staled 80 nightly fixtures](../learnings/1793866079028-slang-test-exit-code-rule-14269-staled-80-nightly-.md).

**Source learnings (9):**
- [slang-test exit-code rule (#14269) staled 80 nightly-only docs/generated fixtures](../learnings/1793866079028-slang-test-exit-code-rule-14269-staled-80-nightly-.md) — PR sweep covered `tests/` only; triage by FAILED set vs previous green nightly; Nightly Coverage Pages budget red
- [Release-regression fixture lists for docs/generated nightlies include expected-failure rows — diff against FAILED lines](../learnings/1793866800949-release-regression-fixture-lists-for-docs-generate.md) — 89 messages vs 80 FAILED; `gh pr view --json files` caps at 100
- [docs/generated nightly exit-code break after slang-test #14269: blanket exit-code=N masks ~22 real failures](../learnings/1793866828932-docs-generated-nightly-exit-code-break-after-slang.md) — local repro command; failure categories; `.actual` files; retry-verdict noise
- [slang-test exit-code-only failures print no tool output — "no E99999 in the CI log" proves nothing](../learnings/1793866967333-slang-test-exit-code-only-failures-print-no-tool-o.md) — 7 hidden SPIR-V validation E99999; exit -1 not -2 (#14303)
- [Doc-test E99999 triage: 4 of 7 ir-reference fixtures are compiler bugs, 3 are invalid spirv_asm](../learnings/1793867580734-doc-test-e99999-triage-4-of-7-ir-reference-fixture.md) — negative constant index, #13519, #13530, spirv_asm OpCapability
- [docs/generated agentic fixtures: common invalid-input patterns (E31211, E38207, -specialize, -lang glsl)](../learnings/1793867764880-docs-generated-agentic-fixtures-common-invalid-inp.md) — numthreads(1,1,1)+Sample; `-specialize` last-entry only; positional `-lang glsl`
- [Docs-only PRs skip every build/test job in ci.yml; .actual files hold the full output for exit-code-only failures](../learnings/1793870186670-docs-only-prs-skip-every-build-test-job-in-ci-yml-.md) — 44 jobs skipped; `.actual` N numbering; spirv-val and StaticAssert caveats
- [slang-test now fails filecheck SIMPLE tests on non-zero exit unless exit-code=N (#14269)](../learnings/1793897749447-slang-test-now-fails-filecheck-simple-tests-on-non.md) — `diag=` unchecked (#14266); REFLECTION/INTERPRET (#14299); old branches break on merge
- [docs/generated fixture sweeps must also fix the generator prompts; a CHECK-DAG pin can shrink a leading CHECK-NOT](../learnings/1793872226026-docs-generated-fixture-sweeps-must-also-fix-the-ge.md) — #14343 left `_common.md` and `keywords-and-builtins/_prompt.md` prescribing the old shape
