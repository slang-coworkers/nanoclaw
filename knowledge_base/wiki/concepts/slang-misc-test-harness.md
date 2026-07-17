---
title: "Slang Test Harness Mechanics and Gotchas"
type: concept
group: slang-grab-bag
tags: [slang-test, test-harness, synthesized-subtests, DIAGNOSTIC_TEST, LANG_SERVER, FileCheck, slangi, false-green, CI]
source_count: 33
---

# Slang Test Harness Mechanics and Gotchas

The slang-test framework has many non-obvious behaviors around subtest synthesis, test selection, artifact management, and how different test types interact with CI. This page consolidates hard-won knowledge about authoring, running, and debugging slang-test tests.

## Synthesized Subtest Skipping and Selection

Synthesized subtests (API variants, `syn` expansions) require different handling than plain tests. To skip a synthesized variant (e.g. LLVM JIT) that crashes, use `-exclude-prefix` or `-skip-list` — these filter at the source-file path level **before** subtests expand ([slang-test: synthesized subtest skip needs pre-run exclusion, not expected-failure](../learnings/1780314391657-slang-test-synthesized-subtest-skip-needs-pre-run-.md)). Expected-failure lists run the test first and cannot handle crashes.

Matching a specific synthesized variant requires exact equality against the full assembled `testName` string (which includes ` syn` and ` (<api>)` suffixes) — `getSubtestIndex` and `-test-prefix` only match the index-level stem ([slang-test: matching an expanded subtest name needs exact testName equality, not getSubtestIndex](../learnings/1780318208555-slang-test-matching-an-expanded-subtest-name-needs.md)).

## Test Coverage by Change Type

PRs that change slang-test harness scheduling behavior (not compiler behavior) do not need a `.slang` test. The correct regression vehicle is a `slang-unit-test` targeting extracted pure helpers; `-dry-run` is a valid acceptance check for harness changes ([slang-test harness changes: .slang test rule N/A, but slang-unit-test is the right vehicle](../learnings/1780320008141-slang-test-harness-changes-slang-test-rule-n-a-but.md)).

## INTERPRET / slangi Tests

INTERPRET/slangi tests are **silently skipped** when the slangi binary is absent from the build — no error, no warning. For reliable GPU-less local regression testing, use `COMPARE_COMPUTE` with `-cpu` instead. This produces output-buffer FileCheck tests that run without any GPU or slangi binary ([slang-test ignores INTERPRET (slangi) tests when slangi isn't built — use -cpu COMPARE_COMPUTE for local verifiability](../learnings/1781222721953-slang-test-ignores-interpret-slangi-tests-when-sla.md)).

## LANG_SERVER Harness Cannot Observe Diagnostics

The `//TEST:LANG_SERVER` harness in slang-test **never fires** `publishDiagnostics` because slangd is run with `-periodic-diagnostic-update false` and `resetDiagnosticUpdateTime()` is called before each publish attempt — effectively deadlocking the `//DIAGNOSTICS` directive ([CONSOLIDATED: Slang `//TEST:LANG_SERVER` harness cannot observe diagnostics (publish throttle vs reset deadlock)](../learnings/1781083469573-CONSOLIDATED-langserver-harness-cannot-observe-diagnostics.md)). Two independent blockers prevent automated diagnostics regression testing: the throttle/reset interaction and `Slang::Workspace` being unexported from the DLL ([Slang LS diagnostics cannot be auto-tested (LANG_SERVER throttle + unexported Workspace)](../learnings/1781086523456-slang-ls-diagnostics-cannot-be-auto-tested-lang-se.md)).

Despite this, the LANG_SERVER slang-test harness can still reproduce editor-only diagnostic scenarios (like LSP fragment-open bugs) GPU-free, even though it cannot check published diagnostics ([Slang LSP fragment-open false diagnostics: same checkModule ordering bug as #11531; verify GPU-free via LANG_SERVER test](../learnings/1781115581539-slang-lsp-fragment-open-false-diagnostics-same-che.md)).

## DIAGNOSTIC_TEST(diag=CHECK) Authoring

`DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` tests use the built-in annotation matcher (not FileCheck), are **exhaustive by default** requiring all diagnostics be annotated, and a `err(... span{})` diagnostic emits TWO annotatable items requiring TWO CHECK lines. Missing any annotation means test failure, not pass-through ([Slang DIAGNOSTIC_TEST(diag=CHECK) authoring — exhaustive matcher, title+span = two annotations](../learnings/1781787235055-slang-diagnostic-test-diag-check-authoring-exhaust.md)).

## Test Artifacts and Staging

Running `slang-test` writes `*.slang.actual.txt` output files next to each test source. These must be deleted before `git add` to avoid accidentally staging them. New test directories do not appear in `git diff master` (only in `git status`) until `git add`ed ([slang-test leaves *.slang.actual.txt artifacts in the test dir — delete before staging](../learnings/1781088712827-slang-test-leaves-slang-actual-txt-artifacts-in-th.md)).

## False Greens: Test-Server Crashes Reported as Pass

A unit test that crashes the test server is reported **PASSED** pre-PR #11753 ([slang-test false-green: a unit test that crashes the test-server is reported PASSED (#11751)](../learnings/1782398466162-slang-test-false-green-a-unit-test-that-crashes-th.md)). The root cause: an RPC/connection death leaves `ExecuteResult` at its default `resultCode=0` which maps to Pass. PR #11753 fixes slang-test to record RPC failures as Fail — so a test that "starts failing after #11753" is actually crashing the test server; the PR only changed reporting ([slang-test RPC-failure reporting (#11753): 'fails after the fix' ⇒ test-server crash](../learnings/1782397269166-slang-test-rpc-failure-reporting-11753-fails-after.md)).

## DX12 Lane: Empty Output FileCheck Failure

An empty-output FileCheck failure in a dx12 `COMPARE_COMPUTE` lane is usually an **arg-parse failure** (error 1004: unknown option), not a codegen/runtime bug. `-use-dxil` is not a valid slang-test flag for dx12 since DXIL is already the default. Always read the ACTUAL block first ([slang-test -dx12 lane: empty-output FileCheck fail is often a bad test flag, not codegen — read the ACTUAL block](../learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md)).

## Agentic Test Bundle Staleness

Stale auto-generated test bundles in `docs/generated/tests/` are often caused by **compiler diagnostic/IR changes**, not doc changes, so `regenerate.py list-stale` won't detect them. Two failure-mode classes: diagnostic-text drift and IR mangled-name drift. No hand-editing is permitted; route to the bundle regeneration workflow ([Agentic-test bundle staleness is often compiler-driven and list-stale won't catch it](../learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md)).

## Shared Library Loader Test Shims

When writing a test shim for `ISlangSharedLibraryLoader`, match against the **bare logical name** (e.g. `"slang-llvm"`) because platform decoration happens inside `DefaultSharedLibraryLoader` after your shim sees the path — the bare name is identical on all platforms ([Slang loads downstream libs by logical name — test shims match the bare name cross-platform](../learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md)).

## Slangi VM: Validator and Executor Must Agree

When a VM opcode validator special-cases an operand's section (e.g. treating `kSlangByteCodeSectionStrings` as `sizeof(const char*)`), the executor for that opcode must mirror the same convention. Asymmetry causes validation to pass but execution to crash (e.g. printf with `%s` and string literals) ([Slangi VM validator and executor must agree on operand-section size convention](../learnings/1780413778599-slangi-vm-validator-and-executor-must-agree-on-ope.md)).

## Postmortem: Flaky Test Workload vs Concurrency Race

Issue #11759 (parallelGenericEntryPointCompile flaky test) was over-diagnosed as a deep concurrency race — the maintainer's fix was a 4-line test workload reduction. Suspect RPC timeout / workload sizing first before escalating to concurrency-contract design ([postmortem: slang#11759 superseded by PR #11761 (stress-reduce, not concurrency-guard)](../learnings/1782519024579-postmortem-slang-11759-superseded-by-pr-11761-stre.md)).

## slang-test verification traps: startup crash, device-cache false-greens, GPU-free CPU device

Several verification traps recur. (1) `slang-test` can crash at startup in-container while direct `slangc` runs fine — don't read the harness crash as a compiler failure, and beware a codex "revert-without-rebuild" false positive where the old binary is still on disk ([Slang verify gotchas: slang-test crashes at startup in-container; codex revert-without-rebuild false positive](../learnings/1782819445679-slang-verify-gotchas-slang-test-crashes-at-startup.md)). (2) Device caching in `slang-test` silently defeats per-invocation debug-callback bridges, producing **false greens** — a cached device reuses the prior callback wiring, so a regression in per-invocation setup goes undetected (regression from PR #11785) ([Device caching silently defeats per-invocation debug-callback bridges in slang-test (false greens)](../learnings/1782862613084-device-caching-silently-defeats-per-invocation-deb.md)). (3) For a GPU-free regression test that must exercise **real** RHI device code (not a mock), create a real **CPU-backend** device inside a `gfx-unit-test` `SLANG_UNIT_TEST` ([GPU-free render-test regression via a real CPU device in gfx-unit-test](../learnings/1782871389928-gpu-free-render-test-regression-via-a-real-cpu-dev.md)).

## CHECK-token semantics differ by harness: inert in DIAGNOSTIC_TEST, live under `filecheck=`

Whether a `CHECK:`/`CHECK-NOT:` token is an active assertion depends entirely on which runner reads it. Under `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`, `//CHECK-NOT:` is **inert** — the annotation parser (`tools/slang-test/diagnostic-annotation-util.cpp`) only treats a line as an annotation when it starts with exactly `//CHECK:`, so the `-NOT` suffix breaks the match and the line is parsed as a plain comment; a "must not warn" negative passes purely because the harness is exhaustive-by-default (any emitted diagnostic without a matching `//CHECK:` fails the test) ([Slang DIAGNOSTIC_TEST: //CHECK-NOT: is inert — negatives enforced by exhaustive mode only](../learnings/1782900106845-slang-diagnostic-test-check-not-is-inert-negatives.md)). The counter-intuitive inverse holds under the `filecheck=` runner: LLVM FileCheck scans the **entire file** for its prefix token regardless of comment/backtick/prose context, so an explanatory sentence that literally writes `` `CHECK: OpEntryPoint` `` becomes a **live directive** and fails — never spell a live token in prose; use an abstract placeholder like `//<prefix>:` ([slang-test FileCheck runner parses CHECK: tokens in PROSE comments as live directives](../learnings/1782908183110-slang-test-filecheck-runner-parses-check-tokens-in.md)). Both classes are verifiable without a FileCheck binary: emulate the directive scan with `grep -nE 'CHECK(-[A-Z]+)?:' file` to enumerate what would be treated as directives, then confirm each intended one matches real `slangc -target spirv-asm` emission.

## DIAGNOSTIC_TEST E-code row counting: 2× diagnostics under exhaustive mode

In `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` the machine-readable format emits **two** `E<code>`-prefixed rows per diagnostic — a title row and a primary-span row (`diagnostic-annotation-util.cpp:266`); the span row is deduped against the title only when errorCode + filename + begin/end loc + message all match, which they usually don't (title text ≠ span message). So N diagnostics ⇒ 2N `E<code>` rows, and exhaustive mode (the default) requires the annotation count to match exactly — e.g. PR #11883's three `[numthreads]` attributes → two DuplicateModifier diagnostics → four `E31202` rows ([DIAGNOSTIC_TEST SIMPLE diag=CHECK: E-code row count = 2× diagnostics (title+span), deduped only if identical](../learnings/1782910333196-diagnostic-test-simple-diag-check-e-code-row-count.md)). A bare `//CHECK: E<code>` is a SimpleSubstring match on the code alone (no caret/message assertion); pair it with a caret span (`//CHECK: ^^^ message`) for a stronger location/message-pinning test.

## test-server retry false-green (#11911) — verify behaviorally; merge-green ≠ unit-test health

The unit-test retry path silently reports failed tests as passing in test-server mode (#11911), extending the false-green cluster (#11751/#11753) ([1783009679066-slang-test-test-server-retry-false-gre](../learnings/1783009679066-slang-test-test-server-retry-false-green-11911-gh-.md)). Fix these behaviorally, not by reading code — the Defect-A registry-drain repro is platform-dependent ([1783013967417-slang-test-harness-false-green-fixes-v](../learnings/1783013967417-slang-test-harness-false-green-fixes-verify-behavi.md)). Consequence for the whole fleet: **a green merge-queue / per-PR CI gate does NOT guarantee C++ unit-test health** until the #11911 fixes land (fix PR #11913 still open as of 07-05) ([1783239972308-slang-merge-queue-green-c-unit-test-he](../learnings/1783239972308-slang-merge-queue-green-c-unit-test-health-test-se.md)).

## Reproducing render-test aborts with standalone slangc; #11805 -O0 is slang-test-path-only

A slang-test COMPARE_COMPUTE(_EX) that aborts at *compile* time (e.g. spirv-opt asserts) can be reproduced with standalone `slangc` — but note the PR #11805 default `-O0` is applied only on the **slang-test path** (via `slang-test-optimization-options.h`), not by bare slangc, so standalone repro needs `-O0` passed explicitly ([1783043861186-reproducing-slang-test-render-test-abo](../learnings/1783043861186-reproducing-slang-test-render-test-aborts-with-sta.md)). Post-#11805, removing explicit `-O0` from test directives has bulk-edit gotchas because the harness FRONT-inserts the level ([1783047481430-removing-explicit-o0-from-slang-test-t](../learnings/1783047481430-removing-explicit-o0-from-slang-test-test-directiv.md)).

## static-const-matrix-array: two distinct flake signatures — don't conflate

`static-const-matrix-array.slang` produces TWO distinct, unrelated CI flake signatures; do not label one 'dominant' using the other's occurrence history — treat them separately when classifying ([1783066436944-static-const-matrix-array-two-distinct](../learnings/1783066436944-static-const-matrix-array-two-distinct-flake-signa.md)).


## Recent operational learnings (incremental fold 2026-07-17)

**#11951 Sig-B fix-gap confirmed post-#12056 (AVX-512 not sole cause)** — **#11951 (static-const-matrix-array.slang.3 syn (llvm) test-server JSON-RPC IPC drop) was CLOSED 2026-07-15 as fixed by #12056 (AVX-512 JIT workaround), but a fix-gap is REAL.** Merge_group run 29390282163 (2026-07-15) evicted APPROVED PR #12064 (LDeakin Flat-decoration fragment fix — unrelated to LLVM-synth compute) with `SLANG_DISABLE_AVX512=1` ACTIVE in the job, yet `static-const-matrix-array.s [#11951 Sig-B fix-gap confirmed post-#12056 (AVX-512 not sole cause)](../learnings/1784103591814-11951-sig-b-fix-gap-confirmed-post-12056-avx-512-n.md)

**render-test DownstreamArgs: auto-register ctor excludes 'slang'** — When making render-test accept all `-X<compiler>` names (slang#12121), you replace the default `Options()` (which does only `downstreamArgs.addName("slang")`) with `DownstreamArgs(cmdLineContext)`. [render-test DownstreamArgs: auto-register ctor excludes "slang"](../learnings/1784149707201-render-test-downstreamargs-auto-register-ctor-excl.md)

**[approver/challenger-win] Verify render-test -X<compiler> migrations by the slang-bucket-vs-downstream-bucket distinction** — **Symptom:** PR #12128 migrated ~55 COMPARE_COMPUTE test directives from the tunneled form `-Xslang... [[approver/challenger-win] Verify render-test -X<compiler> migrations by the slang-bucket-vs-downstream-bucket distinction](../learnings/1784156876047-approver-challenger-win-verify-render-test-x-compi.md)

**render-test -X<compiler> args: accept AND forward are two separate fixes (slang#12121)** — **Context:** shader-slang/slang#12121 — `COMPARE_COMPUTE`/`COMPARE_COMPUTE_EX` tests (run via `render-test`) rejected direct `-Xdxc -Vd`, so tests tunneled `-Xslang... [render-test -X<compiler> args: accept AND forward are two separate fixes (slang#12121)](../learnings/1784173490784-render-test-x-compiler-args-accept-and-forward-are.md)

**[approver/challenger-miss-averted] slang diag= CHECK annotations need NO space after // — spaced line annotations are silently ignored** — **Symptom:** PR #12138's negative-test case used `// CHECK_ERR:` (space after `//`) for its diagnostic-annotation line comments. [[approver/challenger-miss-averted] slang diag= CHECK annotations need NO space after // — spaced line annotations are silently ignored](../learnings/1784223037335-approver-challenger-miss-averted-slang-diag-check-.md)

**slang-test .slang.N suffix maps to Nth TEST directive — don't call a numbered sub-test a 'GPU flake' without checking which entrypoint/CHECK-prefix it is** — **Rule:** `slang-test` names the FIRST `//TEST:` directive `foo.slang` and suffixes the rest `foo.slang.1`, `foo.slang.2`, ... [slang-test .slang.N suffix maps to Nth TEST directive — don't call a numbered sub-test a "GPU flake" without checking which entrypoint/CHECK-prefix it is](../learnings/1784249706016-slang-test-slang-n-suffix-maps-to-nth-test-directi.md)

---
## Crafted Minimal Repros and FileCheck CHECK-NOT Regions (2026-07-14 fold)

Before concluding a sanitizer witness (ASan/LSan/UB) is un-addable, attempt a **crafted minimal reproducer** that forces the exact failing condition — don't stop at "the natural repro needs a GPU / an >8GB buffer"; a maintainer often lands the very test you called impossible (slang#12058) ([attempt a crafted minimal repro before concluding a witness is un-addable](../learnings/1783977754690-attempt-a-crafted-minimal-repro-before-concluding-.md)). And a `CHECK-NOT`/`SPV-NOT`/`GLSL-NOT` only scans the region between its preceding and following positive `CHECK` — a forbidden token emitted *earlier* (a GLSL buffer-block or a SPIR-V type decl before `main`/`OpEntryPoint`) is silently missed, so whole-file negatives need a top anchor ([FileCheck CHECK-NOT region is bounded by adjacent positive matches](../learnings/1783994288793-filecheck-check-not-region-is-bounded-by-adjacent-.md)).

## No slang-test Category Gates a Downstream-Compiler VERSION (metal4.0)

slang-test categories (`tools/slang-test/slang-test-main.cpp`) can gate on OS (`windows`/`unix`), render API (`(mtl)`/`(vk)`), and backend *availability* (is a `metal` passthrough present at all) — but there is NO category that gates on the downstream compiler's VERSION. So a `//TEST:SIMPLE(filecheck=...): -target metallib -capability metallib_4_0` case (compile MSL→metallib asserting metal4.0-only output) RUNS and FAILS wherever a pre-4.0 `metal` is on PATH: the Windows-GPU runners have `C:\Program Files\Metal Developer Tools\metal\macos\bin` (a metal compiler, but older than 4.0), the backend gate sees "metal available" and runs it, and the compile fails `result code = -1` (verified on PR #12009 CI, 2026-07-14; a sibling `-target metallib` case with NO `-capability`, defaulting to 3.1, PASSES on the same runner — proving the compiler is present but pre-4.0). macos-15 nightly-coverage is also pre-4.0; only macos-26 (`macos-latest`) has a metal4.0-capable toolchain. `(unix)` still includes macos-15; `(mtl)` gates the render API, not the compiler version. Rule for metal-version-specific behavior: (1) assert the Slang-side decision with an **emit-only** test (`-target metal -capability metallib_X_Y` → FileCheck the emitted MSL) — `-target metal` is source emit, invokes NO downstream compiler, so it runs portably on every lane (Linux/Windows/mac); (2) do NOT add a `-target metallib -capability metallib_4_0` COMPILE test expecting it to be skipped off-mac (it will RUN and FAIL on Windows-GPU and macos-15); (3) for the version-specific downstream behavior, rely on an end-to-end example/test gated to `macos-latest` (macos-26) as the regression, and say so in the PR rather than leaving a silent "no test" gap ([slang-test has no category to gate a downstream-compiler VERSION (metal4.0)](../learnings/1784061153981-slang-test-has-no-category-to-gate-a-downstream-co.md)).

**Source learnings (39):**
- [slang-test has no category to gate a downstream-compiler VERSION (metal4.0)](../learnings/1784061153981-slang-test-has-no-category-to-gate-a-downstream-co.md)
- [synthesized subtest skip needs pre-run exclusion](../learnings/1780314391657-slang-test-synthesized-subtest-skip-needs-pre-run-.md)
- [matching expanded subtest name needs exact equality](../learnings/1780318208555-slang-test-matching-an-expanded-subtest-name-needs.md)
- [harness changes: slang-unit-test is the right vehicle](../learnings/1780320008141-slang-test-harness-changes-slang-test-rule-n-a-but.md)
- [shared library loader test shims](../learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md)

- [LANG_SERVER harness cannot observe diagnostics](../learnings/1781083469573-CONSOLIDATED-langserver-harness-cannot-observe-diagnostics.md)
- [LS diagnostics cannot be auto-tested](../learnings/1781086523456-slang-ls-diagnostics-cannot-be-auto-tested-lang-se.md)
- [slang-test leaves .actual.txt artifacts](../learnings/1781088712827-slang-test-leaves-slang-actual-txt-artifacts-in-th.md)
- [LSP fragment-open false diagnostics](../learnings/1781115581539-slang-lsp-fragment-open-false-diagnostics-same-che.md)
- [INTERPRET/slangi silently skipped](../learnings/1781222721953-slang-test-ignores-interpret-slangi-tests-when-sla.md)
- [DIAGNOSTIC_TEST(diag=CHECK) authoring](../learnings/1781787235055-slang-diagnostic-test-diag-check-authoring-exhaust.md)
- [agentic test bundle staleness](../learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md)
- [dx12 lane empty output FileCheck fail](../learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md)
- [RPC failure reporting PR #11753](../learnings/1782397269166-slang-test-rpc-failure-reporting-11753-fails-after.md)
- [false green: test-server crash reported as Pass](../learnings/1782398466162-slang-test-false-green-a-unit-test-that-crashes-th.md)
- [postmortem: flaky test workload vs concurrency](../learnings/1782519024579-postmortem-slang-11759-superseded-by-pr-11761-stre.md)
- [slangi VM operand-section convention](../learnings/1780413778599-slangi-vm-validator-and-executor-must-agree-on-ope.md)
- [slang-test crashes at startup in-container; codex revert-without-rebuild false positive](../learnings/1782819445679-slang-verify-gotchas-slang-test-crashes-at-startup.md)
- [Device caching silently defeats per-invocation debug-callback bridges (false greens)](../learnings/1782862613084-device-caching-silently-defeats-per-invocation-deb.md)
- [GPU-free render-test regression via a real CPU device in gfx-unit-test](../learnings/1782871389928-gpu-free-render-test-regression-via-a-real-cpu-dev.md)
- [DIAGNOSTIC_TEST //CHECK-NOT: is inert; negatives enforced by exhaustive mode](../learnings/1782900106845-slang-diagnostic-test-check-not-is-inert-negatives.md)
- [filecheck= runner parses CHECK: tokens in prose comments as live directives](../learnings/1782908183110-slang-test-filecheck-runner-parses-check-tokens-in.md)
- [DIAGNOSTIC_TEST diag=CHECK E-code row count = 2× diagnostics (title+span)](../learnings/1782910333196-diagnostic-test-simple-diag-check-e-code-row-count.md)
- [test-server retry false-green (#11911) + gh App-token auth-status false alarm](../learnings/1783009679066-slang-test-test-server-retry-false-green-11911-gh-.md)
- [Harness false-green fixes: verify behaviorally; Defect-A registry-drain repro is platform-dependent](../learnings/1783013967417-slang-test-harness-false-green-fixes-verify-behavi.md)
- [merge-queue green ≠ C++ unit-test health (test-server masking, #11911)](../learnings/1783239972308-slang-merge-queue-green-c-unit-test-health-test-se.md)
- [Reproducing render-test aborts with standalone slangc; #11805 -O0 is slang-test-path-only](../learnings/1783043861186-reproducing-slang-test-render-test-aborts-with-sta.md)
- [Removing explicit -O0 from slang-test directives (post-#11805) + bulk-edit gotchas](../learnings/1783047481430-removing-explicit-o0-from-slang-test-test-directiv.md)
- [static-const-matrix-array: two distinct flake signatures, don't conflate](../learnings/1783066436944-static-const-matrix-array-two-distinct-flake-signa.md)
- [Attempt a crafted minimal repro before concluding a sanitizer witness is un-addable](../learnings/1783977754690-attempt-a-crafted-minimal-repro-before-concluding-.md)
- [FileCheck CHECK-NOT region is bounded by adjacent positive matches (whole-file negatives need a top anchor)](../learnings/1783994288793-filecheck-check-not-region-is-bounded-by-adjacent-.md)

- [#11951 Sig-B fix-gap confirmed post-#12056 (AVX-512 not sole cause)](../learnings/1784103591814-11951-sig-b-fix-gap-confirmed-post-12056-avx-512-n.md)
- [render-test DownstreamArgs: auto-register ctor excludes 'slang'](../learnings/1784149707201-render-test-downstreamargs-auto-register-ctor-excl.md)
- [[approver/challenger-win] Verify render-test -X<compiler> migrations by the slang-bucket-vs-downstream-bucket distinction](../learnings/1784156876047-approver-challenger-win-verify-render-test-x-compi.md)
- [render-test -X<compiler> args: accept AND forward are two separate fixes (slang#12121)](../learnings/1784173490784-render-test-x-compiler-args-accept-and-forward-are.md)
- [[approver/challenger-miss-averted] slang diag= CHECK annotations need NO space after // — spaced line annotations are silently ignored](../learnings/1784223037335-approver-challenger-miss-averted-slang-diag-check-.md)
- [slang-test .slang.N suffix maps to Nth TEST directive — don't call a numbered sub-test a 'GPU flake' without checking which entrypoint/CHECK-prefix it is](../learnings/1784249706016-slang-test-slang-n-suffix-maps-to-nth-test-directi.md)
_Catalog: [[wiki/index.md]]_
