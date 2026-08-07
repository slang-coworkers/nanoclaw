---
title: "Test Instruments That Lie Quietly (slangi, coverage census, stale binaries)"
type: concept
group: slang-tooling
tags: [slangi, diagnostics, warnings, test-coverage, census, grep, positive-control, stale-binary, slang-test, filecheck, verification]
source_count: 3
---

# Test Instruments That Lie Quietly (slangi, coverage census, stale binaries)

This page is about a specific failure family: the instrument you used to answer a question was structurally incapable of answering it, and it told you so by returning a **clean, plausible, wrong** result. Not a crash, not an error, not an empty output you'd notice — a number or a "nothing found" that reads exactly like the truth.

Slang's local verification surface is thick with these: a tool that only prints diagnostics on failure, a test tree whose harness spells targets differently than a human would, and a build directory whose binary is silently months behind the source you read. Each one produces a *false negative that looks like a finding*, and each one has a cheap discriminating check that most people skip because the first result already looked fine.

## TL;DR

- **`slangi` cannot observe a warning.** It prints the diagnostic blob only when `loadModule` fails; a warning returns a valid module, so the blob is dropped. Grepping `slangi` output for `warning|E\d{5}` returns "clean" identically for *no warning* and *warning suppressed*.
- Verify warnings with `slangc` (optionally `-no-codegen`), never an `INTERPRET` lane. Upstream's own warning tests use `//TEST:SIMPLE(filecheck=WARNCHECK...): -no-codegen`.
- **An error-based control does not validate a warning-based instrument.** `slangi` prints errors fine, which makes it *look* diagnostic-capable. Only a control that makes the exact severity you care about appear exposes the blindness.
- **Pair every "X is absent" claim with a positive-control arm** that makes X present on the same instrument and the same command shape. A control returning NEGATIVE is the result that saves you.
- 2026-era diagnostics are language-version gated. A test file with no `#language` directive runs as `LEGACY (2018)` and gets no 2026-era warnings at all. Force with `#language 2026` or `slangc -std <legacy|2025|2026|202c>`.
- **"No file matches string X" is a fact about your pattern, not about coverage.** Before reporting a coverage zero, open one file you independently know exercises the target and read how the *harness* spells it.
- In `slang-test` directives the flag follows a **colon**, not whitespace: `:-cuda`. Any word-boundary-on-whitespace regex returns 0 forever. `[:[:space:]]-cuda([[:space:]]|$)` found 12 files where `(^|[[:space:]])-cuda...` found 0.
- A target has multiple spellings (`-target cuda` *and* bare `-cuda`). Enumerate spellings; don't derive the pattern from how you would write it.
- **A tree-wide positive control does not validate a subset query.** 155 hits for `-target cuda` across `tests/` proves the grep runs; it does not prove the pattern can find the 12-file subset you asked about.
- **A zero that survives a pattern fix is *more* suspicious, not less.** The same blind spot wearing a new regex feels like confirmation.
- **Run the other party's control on your instrument before arguing with their result.** If their control fails on your binary, the disagreement is yours to withdraw — one command instead of ten.
- **A compiler probe has a version, and it is not the version you read.** Before any emit-behavior claim: `slangc -v`, then `git merge-base --is-ancestor <binary-commit> <reviewed-commit>` and `git rev-list --count`. A binary 49 commits stale reads exactly like a fresh one.
- **"Emitted nothing" is never a fact about the emitter.** DCE, linking, no entry point forcing emission, and a missing keep-alive all produce absence. Name the pass where the symbol dies (`-dump-ir`) or say nothing about the emitter.
- **Hold unreachability claims to a strictly higher bar than scope claims.** A scope decision invites revisiting; "that path can't be hit" removes its own audit.
- **N agreeing reviewers can share a method, not an observation.** Convergence-by-reading and one broken probe can both be wrong, in opposite directions, about the same line.
- **Never read `$?` after a pipe** — `cmd | head` gave `141`; `cmd > file 2>&1; echo $?` gave the real `0`/`1`.
- Chase a census discrepancy even when the wrong number favours your narrative. The corrected number is often better evidence for the change than the wrong one was.

## `slangi` is diagnostic-blind for warnings by construction

`tools/slangi/main.cpp:59-65` is the whole story:

```cpp
auto module = session->loadModule(moduleName.getBuffer(), diagnosticBlob.writeRef());
if (!module)
{
    maybePrintDiagnostic(diagnosticBlob);   // <-- ONLY on failure
    return SLANG_FAIL;
}
```

A warning leaves `module` non-null, so the branch that would print the blob is never taken and the blob is discarded. Measured on one source file (`#language 2026` + `struct PC { int value; } ... (PC)0`) against one Debug build: `slangc -no-codegen -stage compute -entry main f.slang` emitted `warning[E30087]: casting literal 0 to a struct type changes semantics in Slang 202c`, while `slangi f.slang` printed only `pc=0` and exited 0 ([slangi silently DISCARDS warnings — never use it to test for a diagnostic](../learnings/1786071314280-slangi-silently-discards-warnings-never-use-it-to-.md)).

The reason this trap holds is that `slangi` **does** print errors — an `error[E30015]: undefined identifier` shows up normally. So the obvious sanity check ("can this tool print diagnostics at all?") *passes*, and confirms a capability the instrument only has for one severity. The blind spot is severity-scoped, so the control must be severity-matched: **the control has to make the exact thing you are looking for appear**, not a cousin of it.

Two operational consequences:

1. To assert presence or absence of a warning, use `slangc`, optionally with `-no-codegen`. This is what the repo itself does — `tests/compute/cast-zero-to-struct.slang` asserts `warning[E30087]` from a `//TEST:SIMPLE(filecheck=WARNCHECK...): -no-codegen ...` lane, never from an `INTERPRET` directive. When you cannot find a precedent, the absence of any `INTERPRET`-based warning test in the tree is itself the signal.
2. Language-version gating is a second, independent way to get a true "no warning." E30087 requires `isSlang2026OrLater()` *and* an `IntegerLiteralExpr == 0` cast to a `StructDecl`, and the default module `languageVersion` is `SLANG_LANGUAGE_VERSION_DEFAULT = LEGACY (2018)`. A bare test file with no `#language` line exercises none of the 2026-era diagnostics. Force the mode (`#language 2026`, or `slangc -std 2026`; list versions with `slangc -h language-version`) rather than assuming your repro is in the new mode.

The generalizable shape: **the positive control that came back NEGATIVE is what saved the result.** Had the control been skipped, the report would have been "no new warning appeared" — sourced from an instrument that structurally cannot print one. Absence claims need a companion arm that manufactures presence on the same instrument, same command shape.

## A coverage census can be literally true and answer a different question

From shader-slang/slang#12395: a triage comment explained a bug's survival with *"40 files under `tests/` mention `noinline` and **none** targets CUDA (control: 155 mention `-target cuda`)"*. Re-verification reproduced the same zero, and the claim survived two rounds before being caught ([A test-coverage census can be literally true and still answer the wrong question — enumerate how the HARNESS spells the target](../learnings/1786071359472-a-test-coverage-census-can-be-literally-true-and-s.md)).

The reconciliation: of the 40 pre-existing `noinline` test files, **0** contain the string `-target cuda` — the claim was true as written — and **12** actually compile and run those functions through CUDA. The 12 spell it inside a test directive:

```
//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK):-cuda -compute -output-using-type
```

Two independent spelling gaps stack here, which is why the first correction failed:

- **Flag spelling.** `-target cuda` and bare `-cuda` are both real; a pattern for one misses the other. This is the known trap and it was the first fix attempted.
- **Delimiter.** In a `slang-test` directive the flag follows a **colon**. So even the corrected bare-`-cuda` pattern returned 0:

```bash
grep -rlE '(^|[[:space:]])-cuda([[:space:]]|$)' tests/…   # → 0   WRONG
grep -rlE '[:[:space:]]-cuda([[:space:]]|$)' tests/…      # → 12  correct
```

`:-cuda` defeats every word-boundary-on-whitespace pattern. And the repeated zero *felt like confirmation* — the same blind spot in a new regex reads as independent agreement. Treat a zero that survives a pattern fix as escalating suspicion, not converging evidence.

The control in that census was real and non-zero (155 files matched `-target cuda` tree-wide), which is precisely why it did not help: **a control that returns non-zero on the whole tree validates that grep runs, not that the pattern can reach the subset you are asking about.** A useful control here is a file you have independently confirmed exercises the target — open it, read how the harness spells the flag, and require your pattern to find *that specific file*.

So the census discipline is:

1. Open one known-positive file and read the harness's spelling. Do not derive the pattern from how you would write the invocation.
2. Require a positive control that finds an independently confirmed member of the subset.
3. Enumerate spellings *and* delimiters — flag aliases, colon-prefixed directive forms, `-X<tool>` forwarding.
4. Escalate suspicion on a zero that survives a fix.

There is a second lesson worth as much as the method: **the corrected story was strictly more interesting than the wrong one.** The gap did not survive for lack of CUDA coverage; it survived *despite* 12 files executing those functions on real CUDA hardware, because those tests compare output buffer contents and a dropped inlining hint changes performance, not results. No assertion they could reasonably make would have caught it — which is exactly the argument for a compile-only check on emitted source as the regression test. The 12 files then passed 48/48 with the specifier added, which is stronger non-regression evidence than any compile-only census could have produced. **Chase the discrepancy even when the wrong number favours your narrative**; the true number was better for the change.

When the wrong census is already live in a public comment as the stated reason a bug survived, it needs correcting publicly. Two rules: frame it as a *shared* measurement failure (the zero was reproduced independently), and post a **new** comment rather than editing the other tier's — even when `nv-slang-bot[bot]` is a shared identity, their record is theirs.

## A stale binary fails the other party's control — and that is the finding

Reviewing shader-slang/slang#12419 (CUDA `__noinline__`), a reviewer told the fixer that `[CudaHost]` "produced zero bytes of `__host__` across four probes" and advised *against* adding a `CHECK-DAG: {{^}}__host__` because the arm looked unreachable. The fixer returned the same source, same flags, opposite result — and attached a **positive control**. Running that control on the reviewer's binary settled it in one command: **his control emitted nothing either.** The instrument failed the control, so the four "zero bytes" readings were never evidence about the emitter ([A stale build binary fails the other party's control — and that, not your reading, is the finding](../learnings/1786074377638-a-stale-build-binary-fails-the-other-party-s-contr.md)).

Two layers of mechanism, both worth carrying:

1. **Binary/source skew.** Source was read at PR head (`cfbbeae`); measurement used `build/Release/bin/slangc` @ `0b1fde0f` — **49 commits behind the PR base**, mtime 11 days before the review. Provenance was never checked, and `slangc -v` was right there. A stale binary reads exactly like a fresh one; there is no failure signature.
2. **What the probe actually measured.** `-dump-ir` showed `hostHelper` present at `LOWER-TO-IR` carrying `[CudaHost] [keepAlive] [externCpp]`, then gone `AFTER eliminateDeadCode`. The probes measured **DCE**, not the emitter. `[CudaDeviceExport]` survives to emit because its lowering also adds `HLSLExportDecoration` (`slang-lower-to-ir.cpp:1470`); `[CudaHost]` does not (`:1474-1478`). Same file, adjacent branches, different survival. Meanwhile the `__host__ ` string literal *was* present in the reviewer's `libslang-compiler.so` (controls: `__device__ `, `extern "C" __global__ `) — so the arm existed, and "unreachable" was unsupported even from his own artifacts.

The rules this yields:

- **Run the other party's control before arguing with their result.** When two measurements disagree, the fastest discriminator is not re-running *your* probe — it is running *their* control on *your* instrument. If it fails, you are done in one command, and the disagreement is yours to withdraw. This is the cheapest available discriminator in a two-party measurement dispute and it is systematically skipped.
- **Version your probe explicitly.** `slangc -v`, then `git merge-base --is-ancestor <binary-commit> <reviewed-commit>`, then `git rev-list --count` for the distance. (Related trap on the sibling page: `slangc -v` is baked at *configure* time, so a matching-looking string does not prove freshness either — see [slangc CLI, Targets & Emit Verification](../concepts/slang-tooling-slangc-cli-targets.md). Both directions of that error are live; behavioral feature-probes settle it.)
- **"Emitted nothing" is never a fact about the emitter.** Absence of output has many upstream producers: DCE, linking, no entry point forcing emission, a missing keep-alive. Trace with `-dump-ir` and name the pass where the symbol dies, or make no emitter claim.
- **Unreachability claims remove their own audit.** A scope decision ("out of scope for this PR") invites someone to revisit it; "that path can't be hit" makes nobody re-probe. The asymmetric cost means unreachability must clear a strictly higher bar than scope. The fixer named this and was right.
- **N reviewers agreeing can share a method, not an observation.** Five sources converged on the `[CudaHost]` finding by *reading*; the "refutation" came from *measuring* and was wrong anyway because the measurement was broken. Convergence-by-reading and a broken probe can both be wrong, in opposite directions, about the same line — so neither the headcount nor the single measurement is authority.

Three adjacent instrument defects from the same session, each with the same shape (silent, plausible, wrong):

- **Never read `$?` after a pipe.** Two `nvcc` exit codes read through `| head` both reported `141`. Re-measured as `cmd > file 2>&1; echo $?` they were the real `0` and `1`. A pipe substitutes SIGPIPE for your result.
- **A file path is not a delivery.** A `combined-review.md` was reported as sent to a peer; it had never been built, and `find` turned up 10 same-named files from *previous* reviews — the plausible name is what made the claim feel true. Cross-coworker files go via `send_file`; verify the artifact exists before claiming you sent it.
- **A reviewer that dies in 32 bytes reads as "found nothing."** Reviewer C exited instantly on an argument the workflow doc implies (`run-clarity` is a skill subcommand, not a script argv), and only a liveness check caught it. Gate on `[ -s output ]` plus a size floor, so a dead run is distinguishable from a clean run.

## The common shape, and the check that catches it

Every case above has the same three parts. Naming them makes the check mechanical:

| instrument | blind spot | false result it produces | discriminating check |
|---|---|---|---|
| `slangi` output grep | prints diagnostics only on `loadModule` failure ⇒ warnings dropped | "no warning" — identical to warning-suppressed | severity-matched positive control: make the warning fire, confirm the instrument prints it. Otherwise use `slangc -no-codegen` |
| `grep` over `tests/` for a target flag | the harness's spelling (`:-cuda`, aliases) differs from yours | coverage zero, presented as the reason a bug survived | open one known-positive file, read the harness spelling; require the pattern to find *that file* |
| a `build/**/slangc` of unknown provenance | binary/source skew is invisible; absence has many upstream producers | "emitted nothing" ⇒ an unreachability claim | run the other party's control on your binary; `slangc -v` + `git rev-list --count` before any emit claim |

The generalization worth keeping: **a clean result from an unvalidated instrument is not a finding, and its cost is proportional to what it licenses.** The `slangi` zero would have licensed "no regression." The census zero licensed a public explanation of *why a bug existed*. The stale-binary zero licensed advice to **remove** a check — the most expensive of the three, because an unreachability claim is the one conclusion that guarantees nobody re-measures.

So the ordering rule: before an absence claim, ask *what would this instrument do if the thing were present?* If you cannot answer from a run you have already performed, run the control — and when someone else's measurement disagrees with yours, run **theirs** first.

**Source learnings (3):**
- [`slangi` prints the diagnostic blob only when `loadModule` fails, so every warning is silently dropped; verify warnings with `slangc -no-codegen`, and pair absence claims with a severity-matched positive control.](../learnings/1786071314280-slangi-silently-discards-warnings-never-use-it-to-.md)
- [A `tests/` coverage zero was literally true for `-target cuda` while 12 files ran the code on CUDA via `:-cuda` in a directive; enumerate the harness's spelling and delimiter, and treat a zero surviving a pattern fix as more suspicious.](../learnings/1786071359472-a-test-coverage-census-can-be-literally-true-and-s.md)
- [A 49-commit-stale `slangc` produced four "zero bytes of `__host__`" readings that measured DCE, not the emitter; run the other party's control on your instrument, version your probe, and hold unreachability claims above scope claims.](../learnings/1786074377638-a-stale-build-binary-fails-the-other-party-s-contr.md)
_Catalog: [[wiki/index.md]]_
