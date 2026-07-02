---
title: "Slang Test Harness Mechanics and Gotchas"
type: concept
group: slang-grab-bag
tags: [slang-test, test-harness, synthesized-subtests, DIAGNOSTIC_TEST, LANG_SERVER, FileCheck, slangi, false-green, CI]
source_count: 19
---

# Slang Test Harness Mechanics and Gotchas

The slang-test framework has many non-obvious behaviors around subtest synthesis, test selection, artifact management, and how different test types interact with CI. This page consolidates hard-won knowledge about authoring, running, and debugging slang-test tests.

## Synthesized Subtest Skipping and Selection

Synthesized subtests (API variants, `syn` expansions) require different handling than plain tests. To skip a synthesized variant (e.g. LLVM JIT) that crashes, use `-exclude-prefix` or `-skip-list` — these filter at the source-file path level **before** subtests expand ([[wiki/learnings/1780314391657-slang-test-synthesized-subtest-skip-needs-pre-run-.md]]). Expected-failure lists run the test first and cannot handle crashes.

Matching a specific synthesized variant requires exact equality against the full assembled `testName` string (which includes ` syn` and ` (<api>)` suffixes) — `getSubtestIndex` and `-test-prefix` only match the index-level stem ([[wiki/learnings/1780318208555-slang-test-matching-an-expanded-subtest-name-needs.md]]).

## Test Coverage by Change Type

PRs that change slang-test harness scheduling behavior (not compiler behavior) do not need a `.slang` test. The correct regression vehicle is a `slang-unit-test` targeting extracted pure helpers; `-dry-run` is a valid acceptance check for harness changes ([[wiki/learnings/1780320008141-slang-test-harness-changes-slang-test-rule-n-a-but.md]]).

## INTERPRET / slangi Tests

INTERPRET/slangi tests are **silently skipped** when the slangi binary is absent from the build — no error, no warning. For reliable GPU-less local regression testing, use `COMPARE_COMPUTE` with `-cpu` instead. This produces output-buffer FileCheck tests that run without any GPU or slangi binary ([[wiki/learnings/1781222721953-slang-test-ignores-interpret-slangi-tests-when-sla.md]]).

## LANG_SERVER Harness Cannot Observe Diagnostics

The `//TEST:LANG_SERVER` harness in slang-test **never fires** `publishDiagnostics` because slangd is run with `-periodic-diagnostic-update false` and `resetDiagnosticUpdateTime()` is called before each publish attempt — effectively deadlocking the `//DIAGNOSTICS` directive ([[wiki/learnings/1781083469573-CONSOLIDATED-langserver-harness-cannot-observe-diagnostics.md]]). Two independent blockers prevent automated diagnostics regression testing: the throttle/reset interaction and `Slang::Workspace` being unexported from the DLL ([[wiki/learnings/1781086523456-slang-ls-diagnostics-cannot-be-auto-tested-lang-se.md]]).

Despite this, the LANG_SERVER slang-test harness can still reproduce editor-only diagnostic scenarios (like LSP fragment-open bugs) GPU-free, even though it cannot check published diagnostics ([[wiki/learnings/1781115581539-slang-lsp-fragment-open-false-diagnostics-same-che.md]]).

## DIAGNOSTIC_TEST(diag=CHECK) Authoring

`DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` tests use the built-in annotation matcher (not FileCheck), are **exhaustive by default** requiring all diagnostics be annotated, and a `err(... span{})` diagnostic emits TWO annotatable items requiring TWO CHECK lines. Missing any annotation means test failure, not pass-through ([[wiki/learnings/1781787235055-slang-diagnostic-test-diag-check-authoring-exhaust.md]]).

## Test Artifacts and Staging

Running `slang-test` writes `*.slang.actual.txt` output files next to each test source. These must be deleted before `git add` to avoid accidentally staging them. New test directories do not appear in `git diff master` (only in `git status`) until `git add`ed ([[wiki/learnings/1781088712827-slang-test-leaves-slang-actual-txt-artifacts-in-th.md]]).

## False Greens: Test-Server Crashes Reported as Pass

A unit test that crashes the test server is reported **PASSED** pre-PR #11753 ([[wiki/learnings/1782398466162-slang-test-false-green-a-unit-test-that-crashes-th.md]]). The root cause: an RPC/connection death leaves `ExecuteResult` at its default `resultCode=0` which maps to Pass. PR #11753 fixes slang-test to record RPC failures as Fail — so a test that "starts failing after #11753" is actually crashing the test server; the PR only changed reporting ([[wiki/learnings/1782397269166-slang-test-rpc-failure-reporting-11753-fails-after.md]]).

## DX12 Lane: Empty Output FileCheck Failure

An empty-output FileCheck failure in a dx12 `COMPARE_COMPUTE` lane is usually an **arg-parse failure** (error 1004: unknown option), not a codegen/runtime bug. `-use-dxil` is not a valid slang-test flag for dx12 since DXIL is already the default. Always read the ACTUAL block first ([[wiki/learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md]]).

## Agentic Test Bundle Staleness

Stale auto-generated test bundles in `docs/generated/tests/` are often caused by **compiler diagnostic/IR changes**, not doc changes, so `regenerate.py list-stale` won't detect them. Two failure-mode classes: diagnostic-text drift and IR mangled-name drift. No hand-editing is permitted; route to the bundle regeneration workflow ([[wiki/learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md]]).

## Shared Library Loader Test Shims

When writing a test shim for `ISlangSharedLibraryLoader`, match against the **bare logical name** (e.g. `"slang-llvm"`) because platform decoration happens inside `DefaultSharedLibraryLoader` after your shim sees the path — the bare name is identical on all platforms ([[wiki/learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md]]).

## Slangi VM: Validator and Executor Must Agree

When a VM opcode validator special-cases an operand's section (e.g. treating `kSlangByteCodeSectionStrings` as `sizeof(const char*)`), the executor for that opcode must mirror the same convention. Asymmetry causes validation to pass but execution to crash (e.g. printf with `%s` and string literals) ([[wiki/learnings/1780413778599-slangi-vm-validator-and-executor-must-agree-on-ope.md]]).

## Postmortem: Flaky Test Workload vs Concurrency Race

Issue #11759 (parallelGenericEntryPointCompile flaky test) was over-diagnosed as a deep concurrency race — the maintainer's fix was a 4-line test workload reduction. Suspect RPC timeout / workload sizing first before escalating to concurrency-contract design ([[wiki/learnings/1782519024579-postmortem-slang-11759-superseded-by-pr-11761-stre.md]]).

## slang-test verification traps: startup crash, device-cache false-greens, GPU-free CPU device

Several verification traps recur. (1) `slang-test` can crash at startup in-container while direct `slangc` runs fine — don't read the harness crash as a compiler failure, and beware a codex "revert-without-rebuild" false positive where the old binary is still on disk ([[wiki/learnings/1782819445679-slang-verify-gotchas-slang-test-crashes-at-startup.md]]). (2) Device caching in `slang-test` silently defeats per-invocation debug-callback bridges, producing **false greens** — a cached device reuses the prior callback wiring, so a regression in per-invocation setup goes undetected (regression from PR #11785) ([[wiki/learnings/1782862613084-device-caching-silently-defeats-per-invocation-deb.md]]). (3) For a GPU-free regression test that must exercise **real** RHI device code (not a mock), create a real **CPU-backend** device inside a `gfx-unit-test` `SLANG_UNIT_TEST` ([[wiki/learnings/1782871389928-gpu-free-render-test-regression-via-a-real-cpu-dev.md]]).

## CHECK-token semantics differ by harness: inert in DIAGNOSTIC_TEST, live under `filecheck=`

Whether a `CHECK:`/`CHECK-NOT:` token is an active assertion depends entirely on which runner reads it. Under `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`, `//CHECK-NOT:` is **inert** — the annotation parser (`tools/slang-test/diagnostic-annotation-util.cpp`) only treats a line as an annotation when it starts with exactly `//CHECK:`, so the `-NOT` suffix breaks the match and the line is parsed as a plain comment; a "must not warn" negative passes purely because the harness is exhaustive-by-default (any emitted diagnostic without a matching `//CHECK:` fails the test) ([[wiki/learnings/1782900106845-slang-diagnostic-test-check-not-is-inert-negatives.md]]). The counter-intuitive inverse holds under the `filecheck=` runner: LLVM FileCheck scans the **entire file** for its prefix token regardless of comment/backtick/prose context, so an explanatory sentence that literally writes `` `CHECK: OpEntryPoint` `` becomes a **live directive** and fails — never spell a live token in prose; use an abstract placeholder like `//<prefix>:` ([[wiki/learnings/1782908183110-slang-test-filecheck-runner-parses-check-tokens-in.md]]). Both classes are verifiable without a FileCheck binary: emulate the directive scan with `grep -nE 'CHECK(-[A-Z]+)?:' file` to enumerate what would be treated as directives, then confirm each intended one matches real `slangc -target spirv-asm` emission.

## DIAGNOSTIC_TEST E-code row counting: 2× diagnostics under exhaustive mode

In `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` the machine-readable format emits **two** `E<code>`-prefixed rows per diagnostic — a title row and a primary-span row (`diagnostic-annotation-util.cpp:266`); the span row is deduped against the title only when errorCode + filename + begin/end loc + message all match, which they usually don't (title text ≠ span message). So N diagnostics ⇒ 2N `E<code>` rows, and exhaustive mode (the default) requires the annotation count to match exactly — e.g. PR #11883's three `[numthreads]` attributes → two DuplicateModifier diagnostics → four `E31202` rows ([[wiki/learnings/1782910333196-diagnostic-test-simple-diag-check-e-code-row-count.md]]). A bare `//CHECK: E<code>` is a SimpleSubstring match on the code alone (no caret/message assertion); pair it with a caret span (`//CHECK: ^^^ message`) for a stronger location/message-pinning test.

---
**Source learnings (24):**
- [[wiki/learnings/1780314391657-slang-test-synthesized-subtest-skip-needs-pre-run-.md]] — synthesized subtest skip needs pre-run exclusion
- [[wiki/learnings/1780318208555-slang-test-matching-an-expanded-subtest-name-needs.md]] — matching expanded subtest name needs exact equality
- [[wiki/learnings/1780320008141-slang-test-harness-changes-slang-test-rule-n-a-but.md]] — harness changes: slang-unit-test is the right vehicle
- [[wiki/learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md]] — shared library loader test shims

- [[wiki/learnings/1781083469573-CONSOLIDATED-langserver-harness-cannot-observe-diagnostics.md]] — LANG_SERVER harness cannot observe diagnostics
- [[wiki/learnings/1781086523456-slang-ls-diagnostics-cannot-be-auto-tested-lang-se.md]] — LS diagnostics cannot be auto-tested
- [[wiki/learnings/1781088712827-slang-test-leaves-slang-actual-txt-artifacts-in-th.md]] — slang-test leaves .actual.txt artifacts
- [[wiki/learnings/1781115581539-slang-lsp-fragment-open-false-diagnostics-same-che.md]] — LSP fragment-open false diagnostics
- [[wiki/learnings/1781222721953-slang-test-ignores-interpret-slangi-tests-when-sla.md]] — INTERPRET/slangi silently skipped
- [[wiki/learnings/1781787235055-slang-diagnostic-test-diag-check-authoring-exhaust.md]] — DIAGNOSTIC_TEST(diag=CHECK) authoring
- [[wiki/learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md]] — agentic test bundle staleness
- [[wiki/learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md]] — dx12 lane empty output FileCheck fail
- [[wiki/learnings/1782397269166-slang-test-rpc-failure-reporting-11753-fails-after.md]] — RPC failure reporting PR #11753
- [[wiki/learnings/1782398466162-slang-test-false-green-a-unit-test-that-crashes-th.md]] — false green: test-server crash reported as Pass
- [[wiki/learnings/1782519024579-postmortem-slang-11759-superseded-by-pr-11761-stre.md]] — postmortem: flaky test workload vs concurrency
- [[wiki/learnings/1780413778599-slangi-vm-validator-and-executor-must-agree-on-ope.md]] — slangi VM operand-section convention
- [[wiki/learnings/1782819445679-slang-verify-gotchas-slang-test-crashes-at-startup.md]] — slang-test crashes at startup in-container; codex revert-without-rebuild false positive
- [[wiki/learnings/1782862613084-device-caching-silently-defeats-per-invocation-deb.md]] — Device caching silently defeats per-invocation debug-callback bridges (false greens)
- [[wiki/learnings/1782871389928-gpu-free-render-test-regression-via-a-real-cpu-dev.md]] — GPU-free render-test regression via a real CPU device in gfx-unit-test
- [[wiki/learnings/1782900106845-slang-diagnostic-test-check-not-is-inert-negatives.md]] — DIAGNOSTIC_TEST //CHECK-NOT: is inert; negatives enforced by exhaustive mode
- [[wiki/learnings/1782908183110-slang-test-filecheck-runner-parses-check-tokens-in.md]] — filecheck= runner parses CHECK: tokens in prose comments as live directives
- [[wiki/learnings/1782910333196-diagnostic-test-simple-diag-check-e-code-row-count.md]] — DIAGNOSTIC_TEST diag=CHECK E-code row count = 2× diagnostics (title+span)
_Catalog: [[wiki/index.md]]_
