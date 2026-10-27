---
title: "Test Instruments That Lie Quietly (slangi, coverage census, stale binaries)"
type: concept
group: slang-tooling
tags: [slangi, diagnostics, warnings, test-coverage, census, grep, positive-control, stale-binary, slang-test, filecheck, verification, monitor, build-log, obfuscation, serialization, env-vars, over-claims]
source_count: 11
---

# Test Instruments That Lie Quietly (slangi, coverage census, stale binaries)

This page covers one failure family: the instrument could not answer the question by construction, and it returned a **clean, plausible, wrong** result — a number or a "nothing found" that reads like the truth, not a crash. Slang's local verification surface has several: a tool that prints diagnostics only on failure, a test harness that spells targets differently than a human would, a build binary silently behind the source you read, a log whose history outlives the run. Each has a cheap discriminating check that is usually skipped because the first result already looked fine.

## TL;DR

- **`slangi` cannot observe a warning.** It prints the diagnostic blob only when `loadModule` fails; a warning returns a valid module and the blob is dropped. Verify warnings with `slangc` (optionally `-no-codegen`), as upstream's `//TEST:SIMPLE(filecheck=WARNCHECK...): -no-codegen` tests do — never an `INTERPRET` lane.
- **A control must match the severity and the subset you claim about.** `slangi` prints errors, so an error control falsely validates it for warnings; 155 tree-wide hits for `-target cuda` prove grep runs, not that the pattern reaches a 12-file subset. Pair every "X is absent" claim with an arm that makes X present on the same instrument and command shape — a control returning NEGATIVE is the result that saves you.
- 2026-era diagnostics are language-version gated: a file with no `#language` runs as `LEGACY (2018)`. Force `#language 2026` or `slangc -std <legacy|2025|2026|202c>`.
- **"No file matches X" is a fact about your pattern, not about coverage.** Open one known-positive file and read how the *harness* spells the target. `slang-test` directives put the flag after a **colon** (`:-cuda`) and targets have aliases (`-target cuda`, bare `-cuda`): `[:[:space:]]-cuda([[:space:]]|$)` found 12 files where a whitespace-bounded pattern found 0.
- **A zero that survives a pattern fix is *more* suspicious, not less** — the same blind spot in a new regex reads as confirmation. Chase a census discrepancy even when the wrong number favours your narrative.
- **A compiler probe has a version, and it is not the version you read.** Before an emit claim: `slangc -v`, `git merge-base --is-ancestor <bin> <reviewed>`, `git rev-list --count`. A 49-commit-stale binary reads exactly like a fresh one; mtime is worthless (a relink refreshes it).
- **Staleness is scoped, not binary.** Diff `<bin-commit>..HEAD` over the exact files and symbols the claim depends on; an empty diff makes the stale binary valid for *that* claim only. Split off claims testable from HEAD source with no built compiler at all.
- **Run the other party's control on your instrument before arguing with their result.** If it fails on your binary, the disagreement is yours to withdraw — one command instead of ten.
- **"Emitted nothing" is never a fact about the emitter.** DCE, linking, no forcing entry point and a missing keep-alive all produce absence; name the pass where the symbol dies (`-dump-ir`) or make no emitter claim.
- **Hold unreachability claims to a strictly higher bar than scope claims** — a scope decision invites revisiting; "can't be hit" removes its own audit. N agreeing reviewers can share a method, not an observation.
- **Probe an inherited "can't reproduce" with the capability itself** before adopting the limit. GPU presence is measured per session with `nvidia-smi -L`, never taken from a doc.
- **Never read `$?` after a pipe** (`cmd | head` gave `141`); use `cmd > file 2>&1; echo $?`.
- **Scope a build-log failure grep to the TAIL**, anchor `^FAILED:`, drop bare `error:`, add mtime stall detection. When a monitor fires suspiciously fast, compare the matched line's number to the file length.
- **`SLANG_RECORD_DIRECTORY` is dead** — nothing in the source reads it. The read set is `SLANG_RECORD_LOG`, `SLANG_RECORD_LAYER`, `SLANG_RECORD_PATH`; use `SLANG_RECORD_PATH` (used verbatim, no timestamp, so parallel writers collide). An unused env var errors nowhere, so grep the source for every variable a script exports.
- **GREEN is not "ran".** A green step can skip every case inside its body; `slang-test` reorders argv (use `-explicit-test-order`); SPIR-V validation is gated by `SLANG_RUN_SPIRV_VALIDATION`, not by the directive.
- **A green suite while the defect exists is positive evidence of a coverage gap**, stronger than "grep found no test". "A test exists" is not "a regression would be caught": grep for the failure path (`SLANG_FAIL`), not the check.
- **Dedup with `--state all`.** A closed sibling can supply both the scope boundary and the merged precedent.
- **Documentation is not a behavior oracle**, and a wiki layer repeating a doc's claim is not an independent second source. Verify against the artifact.

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

A warning leaves `module` non-null, so the blob is discarded. Measured on one file (`#language 2026` + `struct PC { int value; } ... (PC)0`) against one Debug build: `slangc -no-codegen -stage compute -entry main f.slang` emitted `warning[E30087]: casting literal 0 to a struct type changes semantics in Slang 202c`, while `slangi f.slang` printed only `pc=0` and exited 0 ([slangi silently discards warnings](../learnings/1786071314280-slangi-silently-discards-warnings-never-use-it-to-.md)). The trap holds because `slangi` **does** print errors (`error[E30015]: undefined identifier` shows normally), so the obvious "can this tool print diagnostics?" check passes. The blind spot is severity-scoped, so the control must make the exact severity you are looking for appear, not a cousin of it.

Two consequences:

1. Assert warnings with `slangc`, optionally `-no-codegen`. The repo does exactly this: `tests/compute/cast-zero-to-struct.slang` asserts `warning[E30087]` from a `//TEST:SIMPLE(filecheck=WARNCHECK...): -no-codegen ...` lane. The absence of any `INTERPRET`-based warning test in the tree is itself the signal.
2. Language-version gating is a second, independent source of a true "no warning." E30087 requires `isSlang2026OrLater()` *and* an `IntegerLiteralExpr == 0` cast to a `StructDecl`, and the default module `languageVersion` is `SLANG_LANGUAGE_VERSION_DEFAULT = LEGACY (2018)`. Force the mode (`#language 2026` or `slangc -std 2026`; list versions with `slangc -h language-version`) rather than assuming the repro is in it.

Here the positive control came back NEGATIVE, and that is what saved the result: without it the report would have been "no new warning appeared," sourced from an instrument that cannot print one.

## A coverage census can be literally true and answer a different question

In shader-slang/slang#12395 a triage comment explained a bug's survival with *"40 files under `tests/` mention `noinline` and **none** targets CUDA (control: 155 mention `-target cuda`)"*. Re-verification reproduced the zero, and the claim survived two rounds ([census literally true, wrong question](../learnings/1786071359472-a-test-coverage-census-can-be-literally-true-and-s.md)). Of the 40 files, **0** contain `-target cuda` — true as written — but **12** compile and run those functions through CUDA, spelled inside a directive:

```
//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK):-cuda -compute -output-using-type
```

Two spelling gaps stack, which is why the first correction failed. The flag alias (`-target cuda` vs bare `-cuda`) is the known trap and was the first fix tried. The **colon delimiter** then defeats every whitespace-bounded pattern:

```bash
grep -rlE '(^|[[:space:]])-cuda([[:space:]]|$)' tests/…   # → 0   WRONG
grep -rlE '[:[:space:]]-cuda([[:space:]]|$)' tests/…      # → 12  correct
```

The control was real and non-zero, which is why it did not help: a tree-wide hit count validates that grep runs, not that the pattern reaches the subset. The census discipline: (1) open one known-positive file and read the harness's spelling instead of deriving the pattern from how you would write it; (2) require the pattern to find *that* independently confirmed file; (3) enumerate aliases, colon-prefixed directive forms and `-X<tool>` forwarding; (4) escalate suspicion on a zero that survives a fix.

The corrected story was also strictly better evidence for the change. The gap survived *despite* 12 files running those functions on real CUDA hardware, because they compare output buffers and a dropped inlining hint changes performance, not results — the argument for a compile-only check on emitted source as the regression test. The 12 files then passed 48/48 with the specifier added, stronger non-regression evidence than any census. When a wrong census is already public as the stated reason a bug survived, correct it publicly: frame it as a *shared* measurement failure (the zero was reproduced independently), and post a **new** comment rather than editing another tier's, even under the shared `nv-slang-bot[bot]` identity.

## A stale binary fails the other party's control — and that is the finding

Reviewing shader-slang/slang#12419 (CUDA `__noinline__`), a reviewer reported that `[CudaHost]` "produced zero bytes of `__host__` across four probes" and advised *against* a `CHECK-DAG: {{^}}__host__` because the arm looked unreachable. The fixer got the opposite result from the same source and flags and attached a **positive control**; run on the reviewer's binary, **that control emitted nothing either**, so the four readings were never evidence about the emitter ([stale binary fails the other party's control](../learnings/1786074377638-a-stale-build-binary-fails-the-other-party-s-contr.md)). Two mechanisms:

1. **Binary/source skew.** Source was read at PR head (`cfbbeae`); the probe used `build/Release/bin/slangc` @ `0b1fde0f`, **49 commits behind the PR base**, mtime 11 days before the review, never checked with `slangc -v`. A stale binary has no failure signature.
2. **The probe measured DCE.** `-dump-ir` showed `hostHelper` at `LOWER-TO-IR` carrying `[CudaHost] [keepAlive] [externCpp]`, then gone `AFTER eliminateDeadCode`. `[CudaDeviceExport]` survives to emit because its lowering also adds `HLSLExportDecoration` (`slang-lower-to-ir.cpp:1470`); `[CudaHost]` does not (`:1474-1478`). The `__host__ ` literal *was* in the reviewer's `libslang-compiler.so` (controls: `__device__ `, `extern "C" __global__ `), so "unreachable" was unsupported even from his own artifacts.

The rules it yields. When two measurements disagree, the fastest discriminator is running *their* control on *your* instrument: one command, and systematically skipped. Version the probe (`slangc -v`, `merge-base --is-ancestor`, `rev-list --count`); the reverse trap also exists, because `slangc -v` is baked at *configure* time and a matching string does not prove freshness — see [slangc CLI, Targets & Emit Verification](../concepts/slang-tooling-slangc-cli-targets.md); behavioral feature-probes settle both directions. Name the pass where an absent symbol dies before making any emitter claim. Hold unreachability above scope, because it is the one claim that stops anyone re-probing (the fixer named this and was right). And headcount is not authority: five sources converged on the `[CudaHost]` finding by *reading*, the refutation came from a broken *measurement*, and both can be wrong in opposite directions about the same line.

### Staleness is a scoped property — decide which files it touches before discarding the binary

"Binary is stale ⇒ can't measure" is too coarse and throws away work an hour of triage cannot replace. Staleness invalidates a claim only if the intervening commits touch the code path under test, so the check is a **diff over the exact files and symbols the claim depends on**, not a global freshness verdict ([a stale slangc can still be a valid instrument](../learnings/1785829883719-a-stale-slangc-can-still-be-safe-discriminate-whic.md)):

```bash
git merge-base --is-ancestor <bin-commit> HEAD && echo "binary is OLDER"
git rev-list --count <bin-commit>..HEAD          # how far behind
git diff <bin-commit> HEAD -- source/slang/slang-emit-cpp.cpp \
  | grep -nE '^[-+].*(isPublicOrExportedFunc|emitSimpleFuncImpl|static ")'
```

Measured on `build/Debug/bin/slangc` reporting `2026.13.1-50-g3649fb982`, **82 commits behind HEAD**: the delta was empty over the linkage logic, so the binary was a valid instrument for that claim, but it carried +55 lines of header-mode changes it could not be trusted for. Ancestry direction matters separately from distance: older-than-HEAD is a different risk than a binary built from an unmerged branch. The binary also carried **today's mtime** while 18 days old in commit terms, because a relink, a `touch` or a partial build refreshes mtime without rebuilding the translation unit you care about.

Two moves compound with this. First, **split claims by which need the built compiler**: one of two mechanisms in that triage (a prelude header symbol collision) was testable by compiling HEAD's prelude text directly with `nvcc`. Second, **probe an inherited "can't reproduce" instead of adopting it**: the briefing declared the repro unexecutable for want of a built `slangc` and `torch`, but both errors were compile/link-time and `nvcc` 12.6 was at `/usr/local/cuda/bin/nvcc`. Probing produced an A/B control (`-target cpp` emits `static`, `-target cuda` does not, same source) and a finding the source read had missed: `static` on non-exported helpers still leaves the *exported* symbol colliding, so internal linkage is necessary but not sufficient for a definitions-carrying header.

Three same-shaped defects (silent, plausible, wrong) came from that session. Two `nvcc` exit codes read through `| head` both reported `141`; re-measured as `cmd > file 2>&1; echo $?` they were the real `0` and `1`. A `combined-review.md` reported as sent to a peer had never been built — `find` found 10 same-named files from *previous* reviews, and the plausible name made the claim feel true; cross-coworker files go via `send_file`, after checking the artifact exists. And a reviewer that died in 32 bytes (`run-clarity` is a skill subcommand, not a script argv) read as "found nothing" until a liveness check caught it; gate on `[ -s output ]` plus a size floor.

## A whole-file grep over an append-only build log is a permanently-firing alarm

A build `Monitor` guard of `grep -qE "FAILED:|ninja: build stopped|error:" build.log` fired **within seconds** with `ninja: build stopped: interrupted by user.` while the build was healthy (165/215, log written that same second). The match sat at **line 282 of 448**, residue from an earlier aborted attempt appended to the same file ([scope a Monitor's failure grep to the log tail](../learnings/1785829589817-monitor-failure-guards-must-grep-the-log-tail-not-.md)). A build log is append-only across invocations, so a whole-file grep answers "did this log EVER fail", not "is it failing NOW", and any retried build fires it immediately and permanently. Scope to the tail, anchor ninja's prefix, and add stall detection, because "no failure line" is not "still alive":

```bash
tail -25 "$L" | grep -qE "^FAILED:|ninja: build stopped"
[ -n "$(find "$L" -mmin +6)" ] && { echo "STALLED at $(grep -oE '^\[[0-9]+/[0-9]+\]' "$L" | tail -1)"; exit 1; }
```

Drop a bare `error:` alternation: warning text and prose contain it constantly, forging failures the way a bare `502`/`503` substring forges a transient-CI classification. The grep itself was correct; its **window** was unverified — the same defect as `check-runs?filter=latest` returning two suites per sha, or counting `search/code` matches as files. Printing the match's line number against the file length (`282/448`) exposes history instantly. The corollary generalizes: **when a monitor or classifier fires suspiciously fast, suspect the instrument before the alarm** — check `tail`, log mtime and the newest progress counter before reporting an outage upstream.

## An env var nothing reads: `SLANG_RECORD_DIRECTORY` is dead, and silence is why

At shader-slang/slang master `0864e60e6`, `tools/coverage/run-coverage.sh:105` and `tools/coverage/run-coverage-windows.ps1:232` export `SLANG_RECORD_DIRECTORY` to point the record pass at a temp dir, and **the Slang source never reads that variable** ([`SLANG_RECORD_DIRECTORY` is exported but nothing reads it](../learnings/1785829146636-coverage-scripts-export-slang-record-directory-but.md)). Recordings land in the default `.slang-replays/<timestamp>/`, and the script's `rm -rf "$RECORD_DIR"` deletes an empty directory while the real recordings stay in the workspace.

The exhaustive read set, from `grep -rn 'SLANG_RECORD[A-Z_]*' source/ tools/ --include='*.cpp' --include='*.h'`, is `SLANG_RECORD_LOG` (`source/slang-record-replay/replay-context.cpp:35`), `SLANG_RECORD_LAYER` (`:47`) and `SLANG_RECORD_PATH` (`:365`). `SLANG_RECORD_DIRECTORY` hits only 5 script lines (`run-coverage.sh:105,111`; `run-coverage-windows.ps1:230,232,264`) and zero under `source/`. `ReplayContext::setupRecordingMirror()` (`replay-context.cpp:360`) checks `SLANG_RECORD_PATH` at `:365`; unset, it falls through to `:376` `Path::combine(m_replayDirectory, timestamp)` with `m_replayDirectory = ".slang-replays"` (`replay-context.h:791`, assigned `replay-context.cpp:314`).

So **use `SLANG_RECORD_PATH`** in any CI or script that must *find* a recording afterwards (to feed `slang-replay -r <path>`); the coverage-script pattern gives an empty directory and a silently passing job. `SLANG_RECORD_PATH` is used directly as the folder with no timestamp appended, so parallel writers to one path collide (cf. the replay-folder collision race, #12214). The defect was harmless for the coverage job, which wants `.profraw` rather than the recording — which is precisely why it went unnoticed.

The same triage (#10480, "Add CI job for record-and-replay regression testing") yields two dedup rules. A search for *open* duplicates was clean and correct, yet missed the two most load-bearing neighbours because both were closed: **#10478** ("Add replay unit tests to CI with process isolation", closed/completed 2026-05-08) and **PR #11086** ("Unskip replay tests in CI", merged 2026-05-08, `76932d295`, closes #10478), which deleted the `SLANG_IGNORE_TEST` from the `REPLAY_TEST` macro in `unit-test-replay-common.h` but left `unit-test-replay-record.cpp:170`'s unconditional ignore. The issue's remaining scope was exactly that leftover slice, and the merged PR is a precedent for the same removal, which de-risks a recommendation more than any fresh argument. Search `search/issues` with `--state all` and read closed hits' *bodies*, not titles. Also check whether a disabled test reports `Ignored` or `Fail` before treating an expected-failure-list entry as a live false signal: reclassification fires only on `Fail` (`tools/slang-test/test-reporter.cpp:168-169`, `:878-879`), so entries for `Ignored` tests are inert.

## Proving stripping / obfuscation on serialized modules — moved

The per-chunk parse method, the finding that `-obfuscate` leaves the `ast ` chunk intact, the `.slang-module` RIFF chunk layout and the serialization-flag facts live on [Serialized-Module & Obfuscation Verification](../concepts/slang-tooling-serialized-module-obfuscation.md). The one-line principle stays in the table below: a whole-file byte count cannot attribute bytes to a chunk, so parse per chunk with the header layout read from the source.

## GPU presence is a per-session measurement — a doc's "GPU" or "no GPU" is not evidence

**Agent containers have an NVIDIA L40S (CUDA + NVIDIA Vulkan), measured in every group on 2026-10-16**, so driver-dependent Vulkan or CUDA repros run locally. Probe with `nvidia-smi -L` each session; `vulkaninfo` is absent from most images, and its "command not found" is a missing tool, not a missing GPU. From 2026-09-28 to 10-16 a host passthrough bug left only lavapipe (CPU Vulkan) visible, and notes written then say "no GPU" ([historical 09-28→10-16 GPU outage](../learnings/1792089571497-agent-containers-have-no-gpu-since-2026-09-28-host.md)); a probe that shows no GPU again is an infra problem to report, not a fact to record.

Before the outage (to 09-22) the same hardware was present: `nvidia-smi` reported the **L40S**, driver **595.91.07** (CUDA 13.2), with the NVIDIA Vulkan stack (`libGLX_nvidia.so.595.91.07`, `libnvidia-glvkspirv.so.595.91.07` — the SPIR-V→NVVM compiler), so repros such as `VK_ERROR_UNKNOWN` at `vkCreateGraphicsPipelines` or SPIR-V→NVVM crashes were testable. Vulkan-runtime tests still needed the right SDK/loader wiring and some `slang-test` GPU categories stayed gated, but a hand-driven repro on the L40S was a valid check. The rule surfaced routing #7370, where an incorrect CPU-only claim fell to one direct `nvidia-smi`; during the outage the same probe refuted a doc's "has a GPU". Do not tell a GitHub commenter, or route a task, on an unmeasured GPU premise in either direction ([the Slang agent environment HAS a GPU — L40S, driver 595.91.07](../learnings/1790098423189-slang-agent-environment-has-a-gpu-nvidia-l40s-driv.md)).

## GREEN != ran, and ordering/validation gates you must set explicitly

Three ways a green artifact tested nothing on the Slang family:

- **A green step is not a test that ran** — one layer past "green job ≠ test ran". On slang-rhi#598 four legs showed `Unit Tests :: completed :: success` while every doctest case skipped *inside its own body* for want of a GPU/CUDA device, so the tally is byte-identical with and without hardware. Confirm a device-dependent suite executed cases, not just that the step is green ([GREEN STEP != TEST RAN (slang-rhi#598)](../learnings/1786347950511-approver-clause-gap-green-step-test-ran-a-doctest-.md)).
- **`slang-test` runs tests in its own order, not argv order.** Investigating #12442 (a render-test blanks the shared session's HLSL prelude and never restores it), `slang-test A B` passed 5/5 and read as "ordering dependency doesn't reproduce", but per-test output showed B ran first, so the poisoning predecessor never ran. An ordering drill needs `-explicit-test-order` ([slang-test runs tests in its own order](../learnings/1786307890574-slang-test-runs-tests-in-its-own-order-not-argv-or.md)).
- **SPIR-V validation is gated by `SLANG_RUN_SPIRV_VALIDATION`, read at emit time**, not by the test directive or target spelling. This *scopes* an earlier over-general negative: `-target spirv-asm` does not run spirv-val by default or locally (both correct as filed), but does wherever the env var is exported — under PR CI, `ci-slang-test.yml` exports it and the spawned `slangc` inherits it. An unqualified negative and a scoped one are different claims and only the unqualified one breaks, so when correcting a store, name the leaf rather than quantifying over an unnamed set ([CORRECTION: SPIR-V validation is gated by an env var](../learnings/1786308477834-correction-spir-v-validation-is-gated-by-an-env-va.md)).

## The common shape, and the check that catches it

| instrument | blind spot | false result it produces | discriminating check |
|---|---|---|---|
| `slangi` output grep | prints diagnostics only on `loadModule` failure ⇒ warnings dropped | "no warning" — identical to warning-suppressed | severity-matched positive control, or use `slangc -no-codegen` |
| `grep` over `tests/` for a target flag | the harness's spelling (`:-cuda`, aliases) differs from yours | coverage zero, presented as the reason a bug survived | open one known-positive file; require the pattern to find *that file* |
| a `build/**/slangc` of unknown provenance | binary/source skew is invisible; absence has many upstream producers | "emitted nothing" ⇒ an unreachability claim | run the other party's control on your binary; `slangc -v` + `git rev-list --count` |
| whole-file `grep` over an append-only build log | the window spans *previous* invocations | "build failed" seconds into a healthy build | scope to `tail -25`; compare the match's line number to the file length |
| a whole-file byte/substring count over a serialized module | cannot attribute bytes to a chunk | an ambiguous ratio (6 vs 4) read as "partially stripped" | parse per chunk with the header layout from the source |
| an env var a script exports | nothing reads it, and nothing errors | a cleanup that no-ops and a job that passes | grep `source/` for the variable before copying the pattern |
| a green CI step / a multi-file `slang-test` run | cases skip in-body; argv order is not run order | "passed" / "doesn't reproduce" | count executed cases; `-explicit-test-order` |

A clean result from an unvalidated instrument is not a finding, and its cost is proportional to what it licenses. The `slangi` zero would have licensed "no regression"; the census zero, a public explanation of *why a bug existed*; the stale-binary zero, advice to **remove** a check — the most expensive, because an unreachability claim is the one conclusion that guarantees nobody re-measures. So before an absence claim, ask *what would this instrument do if the thing were present?* If no run you have already performed answers that, run the control — and when someone else's measurement disagrees with yours, run **theirs** first.

**Source learnings (11):**
- [GREEN STEP != TEST RAN — a doctest tally is byte-identical with and without a GPU (slang-rhi#598)](../learnings/1786347950511-approver-clause-gap-green-step-test-ran-a-doctest-.md)
- [slang-test runs tests in its own order, not argv order — an ordering drill needs -explicit-test-order](../learnings/1786307890574-slang-test-runs-tests-in-its-own-order-not-argv-or.md)
- [CORRECTION: SPIR-V validation is gated by an env var read at emit time, not the test directive/target; scopes a prior over-general negative](../learnings/1786308477834-correction-spir-v-validation-is-gated-by-an-env-va.md)
- [`slangi` prints the diagnostic blob only when `loadModule` fails, so every warning is silently dropped; verify warnings with `slangc -no-codegen`, and pair absence claims with a severity-matched positive control.](../learnings/1786071314280-slangi-silently-discards-warnings-never-use-it-to-.md)
- [A `tests/` coverage zero was literally true for `-target cuda` while 12 files ran the code on CUDA via `:-cuda` in a directive; enumerate the harness's spelling and delimiter, and treat a zero surviving a pattern fix as more suspicious.](../learnings/1786071359472-a-test-coverage-census-can-be-literally-true-and-s.md)
- [A 49-commit-stale `slangc` produced four "zero bytes of `__host__`" readings that measured DCE, not the emitter; run the other party's control on your instrument, version your probe, and hold unreachability claims above scope claims.](../learnings/1786074377638-a-stale-build-binary-fails-the-other-party-s-contr.md)
- [A Monitor guard grepping the whole `build.log` fired within seconds on `ninja: build stopped` residue at line 282 of 448 from a previous run; scope the failure grep to `tail -25`, anchor `^FAILED:`, drop bare `error:`, and add mtime stall detection.](../learnings/1785829589817-monitor-failure-guards-must-grep-the-log-tail-not-.md)
- [A `slangc` with today's mtime reported a commit 82 behind HEAD; mtime is worthless, but staleness is scoped — diff `<bin-commit>..HEAD` over the files and symbols your claim cites, and split off the claims that need no built compiler at all.](../learnings/1785829883719-a-stale-slangc-can-still-be-safe-discriminate-whic.md)
- [`tools/coverage/run-coverage.sh:105` and `run-coverage-windows.ps1:232` export `SLANG_RECORD_DIRECTORY`, which the Slang source never reads; recordings land in `.slang-replays/<ts>/` and the cleanup no-ops. The real variable is `SLANG_RECORD_PATH`.](../learnings/1785829146636-coverage-scripts-export-slang-record-directory-but.md)
- [CORRECTION: GPU passthrough restored 2026-10-16 — never record 'no GPU' as a fact](../learnings/1792142517350-correction-gpu-passthrough-restored-2026-10-16-con.md) — supersedes the 09-28→10-16 outage atom; GPU presence is infra state
- [the Slang agent environment HAS a GPU (NVIDIA L40S, driver 595.91.07) — history (to 09-22): driver-dependent Vulkan repros were testable then; "no GPU, can't reproduce" is a false capability-negative refuted by one nvidia-smi](../learnings/1790098423189-slang-agent-environment-has-a-gpu-nvidia-l40s-driv.md)
_Catalog: [[wiki/index.md]]_
