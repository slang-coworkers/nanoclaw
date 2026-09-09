---
title: "Slang test authoring: FileCheck efficacy, ignored targets, and confounded lanes"
type: concept
group: slang-tooling
tags: [slang-test, filecheck, testing, cuda, metal, target-switch, gpu-less, test-efficacy]
source_count: 10
---

## TL;DR

The recurring theme is **test efficacy**: a green test in a GPU-less container routinely
proves nothing, because the target it exercises is silently ignored, or an independent flag
produces the signal you attribute to your change, or a `-NOT` sits on a target the code never
runs on.

- **`slang-test` exits 0 when nothing matched.** A filter typo, a positional path arg
  (enumeration comes from `-test-dir`), or a `-test-dir` + trailing filter all run *nothing*
  and read as a pass. Gate on `[0-9]+% of tests passed (n/m)` appearing.
- **The failure marker is `FAILED test:` (UPPERCASE);** the pass marker is lowercase `passed
  test:`. `grep -c '^failed test:'` matches neither and reports 0 failures on a failing log.
- **A `-target hlsl`/`-mtl` subtest is "ignored" (0/0), not run,** in a GPU-less/toolchain-less
  sandbox. A locally-ignored target is an *untested* target — green locally proves nothing
  about it; macOS CI runs the mtl subtest.
- **A cross-target `COMPARE_COMPUTE` listing `-mtl` must not use `double`** — Metal has no
  `double` type; the compiler correctly aborts at emit. Split F64 coverage into a
  no-Metal test file.
- **CUDA diagnostic tests use `-target cuda`, not `-target ptx`** — ptx needs nvrtc (absent on
  CPU CI), which aborts before the pre-emit diagnostic pass.
- **A `-NOT` on a target the code-under-test never runs on is a tautology** — it can't fail.
  Put positive assertions on the target the pass runs on.
- **A target-path flag can mask a behavioral lane** — e.g. `-target ptx` for `-fp-mode fast`
  also passes NVRTC `--use_fast_math`, which produces `.approx` ops regardless of the prelude
  redirect. Isolate by removing every other cause of the signal on that path.
- **Lifting a per-target emit predicate to the base affects every sibling subclass** — enumerate
  the concrete emitters before promoting an override.
- **A `__target_switch` arm nested under a non-implied capability is dead code.**
- **A textual `//CHECK: .GetX` ABI test proves only that Slang emits the call, not that the
  target API has the member** — only DXC (with the NVAPI SDK) catches the real gap.

## The slang-test harness: five instrument traps

`slang-test` returns *believable* answers in the states where it is blind, and five measured
traps from slang#12442 (PR #12465) each cost real time
[the five traps](../learnings/1786405416356-slang-test-harness-instrument-traps-failed-vs-fail.md).
(1) The failure marker is `FAILED test:` (uppercase); the pass marker is lowercase `passed
test:`, so `grep -c '^failed test:'` reports 0 failures on a log with 4 — caught only because
`rc=1` and `60% of tests passed (6/10)` contradicted the counter. Also easy to miscount:
`failed(pending retry)` (a retry, not a verdict) and `failed(expected) test:` (a suppression
matching), and a file yields one cell per `//TEST` directive plus synthesized `... syn (cuda)`
cells — so "the test failed" is ambiguous, always quote the cell name. (2) `slang-test` exits
0 when nothing matched: a positional path arg is only a *prefix filter* (enumeration comes
from `-test-dir`, default `tests/`), so `slang-test docs/generated/tests/<path>` runs nothing,
and `-test-dir` plus a trailing filter also runs nothing. Gate every run on `[0-9]+% of tests
passed \([0-9]+/[1-9][0-9]*` actually appearing. (3) `-explicit-test-order` is mandatory for
any ordering experiment — slang-test picks its own order, so a predecessor-then-victim drill
can run the victim first and pass, reading like "does not reproduce"; note subtests within one
file *do* run in order, so a single `.slang` with `COMPARE_COMPUTE` then a `-target hlsl
SIMPLE` directive can express an ordering dependency. (4) A red `workflow_dispatch` draft-PR CI
check is usually a priority yield (`wait-for-human-priority: priority-gate-yielded`), whose
GitHub conclusion *is* `failure` — report it precisely as "red by design; nothing was built"
on the PR, not as "not a failure" or silence, and count the job kinds before describing them.
(5) The mutating and `--check-only` formatting paths use different file lists (covered fully in
the formatting page); a missing tool makes `--check-only` exit 1 with no formatting problem.
The same atom carries two git/CMake bonuses: `git log --format=%B <sha>` without `-1` walks
every ancestor (a 6.7 MB commit message), and `REQUIRED_BY` in
`tools/render-test/CMakeLists.txt` is the broken idiom for depending on `slang-unit-test`
(put `REQUIRES render-test` on the target instead; verify the edge on the output node with
`ninja -t query`, using a known-good target as a positive control).

## Ignored targets: a locally-green test that tested nothing

A `//TEST:SIMPLE(filecheck=CHECK):-target hlsl` test is reported **"ignored" (0/0, not
pass/fail)** in the GPU-less coworker sandbox — the HLSL/DXC codegen path is filtered out — so
"ignored" ≠ broken (a known-good sibling is also ignored for its `.1` hlsl variant while its
cpu/cuda variants pass). To make a parse/compile-level fix actually verifiable locally, write
the positive test as CPU compute
(`//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type -shaderobj`)
or use the `slangi` interpreter (`//TEST:INTERPRET`)
[bare -target hlsl SIMPLE ignored](../learnings/1787342748842-slang-test-bare-target-hlsl-simple-tests-are-ignor.md).
(That atom also notes the unit-test build target is `libslang-unit-test-tool.so`, that ninja
aborts the *entire* multi-target build on one unknown target name, and the `clang-format-17`
shim.) The same "locally-ignored = untested" principle bites hardest on Metal: a cross-target
`COMPARE_COMPUTE` test listing `-mtl` **must not contain a `double`/`double2/3/4` value**,
because Metal has no `double` type and the compiler *correctly* aborts at emit
(`error[E99997] ... unexpected: 'double' type emitted`) — correct behavior, so the fix is in
the test. This bites silently because the container has no Metal toolchain, so the mtl subtest
is `ignored` and the file "passes" locally, while macOS CI runs it and fails
[COMPARE_COMPUTE -mtl no double](../learnings/1787952374955-a-cross-target-compare-compute-test-that-targets-m.md).
The device-free verification is to emit Metal source directly
(`slangc <test> -target metal -stage compute -entry <e> -o /tmp/out.metal`; exit 0 +
`grep -c '\bdouble\b' == 0`) with a `git stash` must-fail control; the fix pattern that keeps
F64 coverage is to split `double` into its own test targeting only `-cpu`/`-cuda`/`-vk` (never
`-mtl`), since `float`/`int`/`uint`/64-bit ints are Metal-safe.

CUDA has the mirror-image target-selection rule: **diagnostic tests use `-target cuda`, not
`-target ptx`.** `-target ptx` compiles all the way to PTX via the `nvrtc` downstream compiler,
which is absent on CPU CI runners, so the compile aborts with "failed to load downstream
compiler 'nvrtc'" *before* reaching `checkUnsupportedInst` — the expected diagnostic (e.g.
E55215) never fires. `-target cuda` stops at CUDA *source* emission, still runs the pre-emit
diagnostic pass, and needs no nvrtc. This passes locally on a box that has nvrtc (the prod
L40S container) and only fails in CI — hit on slang#12633/PR #12671
[CUDA diagnostic tests use -target cuda](../learnings/1787351942939-cuda-diagnostic-tests-use-target-cuda-not-target-p.md).

## Vacuous and confounded checks

A negative FileCheck assertion (`-NOT`) only has discriminating power if the code path under
test *can* produce the forbidden token on that target. On slang#12718/PR #12723 a regression
test put `// SPIRV-NOT: _slang_dummy` on a `-target spirv` lane, but the fix is a D3D-only IR
pass (`legalizeEmptyCallableDataPayloadsForHLSL`, gated by `isD3DTarget`) that never runs on
SPIR-V — so `_slang_dummy` can never appear there regardless of whether the fix is correct or
broken. The check is a tautology; it gives false assurance because it can't fail. Put positive
assertions on the target the pass runs on (HLSL `int _slang_dummy`, DXIL `define void @`), and
on the unaffected target assert only what genuinely proves correctness (`SPIRV: OpEntryPoint
CallableKHR`) — don't add a `-NOT` on the unaffected target to "document" non-leakage; that's
a comment's job
[-NOT on an unrun target is a tautology](../learnings/1787659385637-a-filecheck-not-on-a-target-the-code-under-test-ne.md).

The subtler cousin is a **flag on the target path masking the signal you attribute to your
change**. Two atoms from the CUDA fast-math redirect work (slang#12619 and its R2/R3 review
#12872) converge on the identical trap: to prove the prelude's `#if
SLANG_CUDA_ENABLE_FAST_MATH` redirect *selects* `__cosf`, the intuitive test is a `-target ptx
-fp-mode fast` lane FileChecking for `cos.approx.f32`. But `-target ptx` routes through
`CUDASource` and compiles with NVRTC, and for `FloatingPointMode::Fast` Slang *also* passes
NVRTC `--use_fast_math` (`slang-nvrtc-compiler.cpp`), which by itself rewrites `sinf`→`__sinf`
— so `.approx` appears in the PTX **even if the prelude gate were deleted**. The fast lane
stays green regardless
[ptx approx confounded by --use_fast_math](../learnings/1788296956279-testing-cuda-fp-mode-fast-redirect-target-ptx-appr.md),
[a target-path flag masks the behavioral test](../learnings/1788297443087-a-target-path-flag-can-mask-what-a-behavioral-code.md).
What such lanes *do* catch is the inverted gate (`#ifndef`, or the define leaking into
non-fast output) — the *default* (no-`-fp-mode fast`) lane gets no `--use_fast_math`, so an
inverted gate makes its PTX approximate and fails its `-NOT`. What they *miss* is a deleted
`#if` body (masked by the flag in fast, absent in default → both green). The robust test
compiles the offline nvcc fixture with the macro on/off **without** `--use_fast_math` and
FileChecks the preprocessed source (`__cosf` vs `::cosf`) or the PTX instruction patterns —
pinning behavior to the gate itself. (You can't FileCheck slangc's `-target cuda` emitted
source directly, because slang-test emits the prelude as an `#include`, so wrapper bodies
aren't in the textual output.) Both atoms note the masking was caught by the codex critique
gate's OUTPUT_REVIEW, not the code-focused review, and one records the meta-lesson: when a
review both suggests a target-X behavioral test and notes target-X applies an independent
optimization flag, check whether the second confounds the first — and run the critique gate
*before* emitting a verdict, not after.

## Cross-target reach: emit predicates and capability nesting

Two atoms concern how a change silently reaches targets you didn't intend. **Lifting a
per-target emit predicate to the shared base affects every sibling subclass.** On slang#12635,
lifting WGSL's nested-static-const fold into `CLikeSourceEmitter` to fix CUDA silently also
changed HLSL, GLSL, and Metal — and Metal regressed, because `metal::array<T,N>` is a struct
wrapper like the CUDA/C++ `FixedArray` and hit the same single-brace "too many initializers"
mis-bind, while Metal (deriving from `CLikeSourceEmitter`, not `CPPSourceEmitter`) had not
received the double-brace fix. Before lifting a predicate, enumerate the concrete subclasses
(`grep "class .*SourceEmitter : public"`) and reason about each — especially struct-wrapper
targets (CUDA/C++, Metal) vs native-array (HLSL) vs constructor-syntax (GLSL/WGSL). "Only
CUDA/C++ need X" is the easy-to-assert-and-wrong claim; Metal has no local toolchain in the
fixer container so its correctness is CI-only (pin the form with a `//TEST:SIMPLE(filecheck=METAL):
-target metal` line and verify the C++ aggregate-init shape via a `g++ -std=c++14` proxy)
[lifting a predicate to the base](../learnings/1787580446019-lifting-a-per-target-emit-predicate-to-the-shared-.md).

Similarly, a `__target_switch` arm `case X:` is selected only if the target's compile
capabilities **imply** X (`slang-ir-specialize-target-switch.cpp:38-66`, most-specific
eligible arm wins), so **nesting `case A:` inside `case B:` makes A's body dead code whenever a
compile enables A but not B.** On slang#12186, `spvBindlessTextureNV` and `spvDescriptorHeapEXT`
are independent siblings under `_spirv_1_0` (neither implies the other); nesting the NV arm
inside the EXT arm would make NV tests (compiled with `-capability spvBindlessTextureNV` only)
skip the EXT arm entirely, so the NV opcodes never emit. Verify the implication chain in
`slang-capabilities.capdef` transitively before nesting — independent siblings make nesting a
latent regression, not a refactor
[__target_switch arm nesting](../learnings/1787959548975-target-switch-arm-nesting-under-a-non-implied-capa.md).

Finally, ABI-level test efficacy: a Slang `//CHECK: .GetX` textual test for NVAPI SER
HitObject ops proves **nothing** about validity — it only confirms Slang emits
`nvHitObj.GetX()`, not that `NvHitObject` *has* `GetX`. The NVAPI shim (`nvHLSLExtns.h`) isn't
bundled in-tree, so only DXC (needs the NVAPI SDK, absent in our env) catches "no member named
X". On #9257 the `GetWorldToObject`/`GetObjectToWorld` mappings emit invalid HLSL because
NVAPI's `NvHitObject` exposes none of those getters; the fix is a `static_assert` on the NVAPI
arm plus a diagnostic test — and crucially, an existing PR (#12089) that edits those exact
lines but only re-gates the capability and keeps the broken mapping (with a textual CHECK-DAG
test that never runs DXC) does *not* fix the bug
[textual ABI test masks the DXC-only bug](../learnings/1787226505940-nvapi-hitobject-transform-getters-9257-textual-abi.md).
The lesson generalizes: an existing PR touching the exact lines is not evidence the bug is
handled — read what it does to the mapping and whether its test exercises the real failure
path (DXC), not just the emit.

**Source learnings (10):**
- [slang-test harness instrument traps: FAILED-vs-failed, priority-yield red, formatting file-list asymmetry](../learnings/1786405416356-slang-test-harness-instrument-traps-failed-vs-fail.md) — Uppercase `FAILED test:`; exit-0-on-nothing gate; `-explicit-test-order` mandatory; priority-yield red-by-design; plus `git log %B` and `REQUIRED_BY` CMake bonuses.
- [NVAPI HitObject transform getters (#9257) — textual ABI test masks the DXC-only bug](../learnings/1787226505940-nvapi-hitobject-transform-getters-9257-textual-abi.md) — `//CHECK: .GetX` proves emit, not API membership; only DXC catches it; PR #12089 re-gates but keeps the broken mapping; static_assert on the NVAPI arm.
- [slang-test bare -target hlsl SIMPLE tests are "ignored" in GPU-less env; unit-test ninja target](../learnings/1787342748842-slang-test-bare-target-hlsl-simple-tests-are-ignor.md) — HLSL/DXC filtered to 0/0; write CPU-compute or `slangi` positive tests; `libslang-unit-test-tool.so`; ninja aborts whole build on one bad target.
- [CUDA diagnostic tests: use -target cuda not -target ptx (ptx needs nvrtc)](../learnings/1787351942939-cuda-diagnostic-tests-use-target-cuda-not-target-p.md) — ptx aborts before `checkUnsupportedInst` on nvrtc-less CI; `-target cuda` runs the pre-emit diagnostic path; green locally on nvrtc boxes, red in CI.
- [Lifting a per-target emit predicate to the shared base affects every sibling subclass](../learnings/1787580446019-lifting-a-per-target-emit-predicate-to-the-shared-.md) — WGSL fold lifted to `CLikeSourceEmitter` regressed Metal (struct-wrapper array); enumerate subclasses; Metal is CI-only, verify with a g++ proxy.
- [A FileCheck -NOT on a target the code-under-test never runs on is a tautology](../learnings/1787659385637-a-filecheck-not-on-a-target-the-code-under-test-ne.md) — D3D-only pass + `SPIRV-NOT` can't fail; put positives on the running target; assert only genuine-correctness positives on unaffected targets.
- [A cross-target COMPARE_COMPUTE test that targets -mtl must not contain a double](../learnings/1787952374955-a-cross-target-compare-compute-test-that-targets-m.md) — Metal has no `double`; emit-time abort is correct; locally-ignored mtl hides it; device-free Metal-source verify + stash control; split F64 into a no-Metal file.
- [__target_switch arm nesting under a non-implied capability makes it unreachable](../learnings/1787959548975-target-switch-arm-nesting-under-a-non-implied-capa.md) — Implication rule from `specialize-target-switch`; NV vs EXT are independent siblings; nesting makes the NV body dead; verify the capdef chain transitively.
- [Testing CUDA fp-mode-fast redirect: -target ptx approx-op FileCheck is confounded by NVRTC --use_fast_math](../learnings/1788296956279-testing-cuda-fp-mode-fast-redirect-target-ptx-appr.md) — `--use_fast_math` produces `.approx` regardless of the prelude gate; default lane catches an inverted gate, both miss a deleted body; robust test = offline fixture without the flag.
- [A target-path flag can mask what a behavioral codegen test claims to prove](../learnings/1788297443087-a-target-path-flag-can-mask-what-a-behavioral-code.md) — slang#12619 sibling: remove every other cause of the signal on the path to isolate; the masking was caught by the OUTPUT_REVIEW critique gate, not the code review.
