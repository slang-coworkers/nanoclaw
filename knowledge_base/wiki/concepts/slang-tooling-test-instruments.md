---
title: "Test Instruments That Lie Quietly (slangi, coverage census, stale binaries)"
type: concept
group: slang-tooling
tags: [slangi, diagnostics, warnings, test-coverage, census, grep, positive-control, stale-binary, slang-test, filecheck, verification, monitor, build-log, obfuscation, serialization, env-vars, over-claims]
source_count: 10
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
- **Scope a build-log failure grep to the TAIL.** A build log is append-only across invocations, so a whole-file grep tests "did this log ever fail", not "is it failing now". Anchor `^FAILED:`; never include a bare `error:` alternation. Add stall detection on log mtime — "no failure line" is not "still alive".
- **When a monitor or classifier fires suspiciously fast, suspect the instrument before the alarm.** Cheapest discriminator: print the matched line's line number and compare it to the file's length.
- **Staleness is not binary — discriminate which files it touches.** mtime is worthless (a relink or partial build refreshes it); cross-check `slangc -v`'s commit against HEAD, then diff `<bin-commit>..HEAD` over the exact files and symbols your claim depends on. Empty diff ⇒ the stale binary is a valid instrument *for that claim* and invalid for others.
- **Split the claim set by which claims actually require the built compiler.** Some are testable from HEAD source directly (compiling prelude text with `nvcc`), so the staleness question never applies.
- **Probe an inherited "can't reproduce" with the capability itself before adopting the limit.** Blockers real for an upstream tier are often not load-bearing for your mechanism.
- **`SLANG_RECORD_DIRECTORY` is dead — nothing in the source reads it.** The exhaustive read set is `SLANG_RECORD_LOG`, `SLANG_RECORD_LAYER`, `SLANG_RECORD_PATH`. Use `SLANG_RECORD_PATH`, which is used verbatim as the folder (no timestamp appended), so parallel writers to one explicit path collide.
- **An unused env var produces no error, so nothing downstream misbehaves to reveal it.** Grep the source for every variable a script exports before copying the pattern.
- **To prove a stripping or exposure claim, parse the container per chunk.** A whole-file byte or substring count cannot locate a leak and turns a decisive result into an ambiguous ratio. Take the header layout from the source, never from a generic RIFF assumption.
- **Run the flow the docs recommend for shipping, not just the convenient one**, or the finding gets waved off as the wrong invocation.
- **A green suite while the defect exists is positive evidence of a coverage gap** — strictly stronger than "grep found no test", because it demonstrates no existing test constrains the property.
- **"A test exists" is not "a regression would be caught."** Grep for the failure path (`SLANG_FAIL`), not the check; a `printf`-and-return-success check covers nothing.
- **Dedup with `--state all`.** A closed sibling can supply both the scope boundary and the merged precedent; "no open duplicate" is not the end of dedup.
- **Documentation is not a behavior oracle** — and a wiki/QA layer that repeats a doc's claim is not an independent second source. Verify the property against the artifact.

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

### Staleness is a scoped property — decide which files it touches before discarding the binary

The version check above tells you the binary is stale; it does not tell you the measurement is dead. `"Binary is stale ⇒ can't measure"` is too coarse, and applying it reflexively throws away work an hour of triage cannot replace. Staleness only invalidates a claim if the intervening commits touch the code path under test, so the check is a **diff over the exact files and symbols the claim depends on**, not a global freshness verdict ([a stale slangc can still be a valid instrument — diff the delta against the files your claim cites](../learnings/1785829883719-a-stale-slangc-can-still-be-safe-discriminate-whic.md)):

```bash
git merge-base --is-ancestor <bin-commit> HEAD && echo "binary is OLDER"
git rev-list --count <bin-commit>..HEAD          # how far behind
git diff <bin-commit> HEAD -- source/slang/slang-emit-cpp.cpp \
  | grep -nE '^[-+].*(isPublicOrExportedFunc|emitSimpleFuncImpl|static ")'
```

An empty result means the logic under test is byte-identical between binary and HEAD, so the stale binary is a **valid instrument for that specific claim** while remaining invalid for others — measured on `build/Debug/bin/slangc` reporting `2026.13.1-50-g3649fb982`, **82 commits behind HEAD**, whose delta was empty over the linkage logic but carried +55 lines of header-mode changes the same binary could not be trusted for. Ancestry direction matters independently of distance: older-than-HEAD is a different risk profile than a binary built from an unmerged branch. And note the mtime trap this closes — the binary carried **today's mtime** while being 18 days old in commit terms, because a relink, a `touch`, or a partial build refreshes mtime without rebuilding the translation unit you care about.

Two moves compound with this. First, **split the claim set by which claims actually need the built compiler**: one of two mechanisms in that triage (a prelude header symbol collision) was testable by compiling HEAD's prelude text directly with `nvcc`, so staleness never entered. You usually need the binary for fewer claims than you assume. Second, **a "can't reproduce" inherited from an upstream tier deserves a capability probe, not adoption** — the briefing declared the repro unexecutable for want of a built `slangc` and `torch`, but both errors were compile/link-time, so neither a GPU nor `torch` was load-bearing, and `nvcc` was present at `/usr/local/cuda/bin/nvcc` (12.6). Probing turned two source-read hypotheses into measurements plus an A/B control (`-target cpp` emits `static`, `-target cuda` does not, same source), which produced a finding the source read had missed: adding `static` to non-exported helpers still leaves the *exported* symbol colliding, so internal linkage is necessary but not sufficient for a definitions-carrying header.

Three adjacent instrument defects from the same session, each with the same shape (silent, plausible, wrong):

- **Never read `$?` after a pipe.** Two `nvcc` exit codes read through `| head` both reported `141`. Re-measured as `cmd > file 2>&1; echo $?` they were the real `0` and `1`. A pipe substitutes SIGPIPE for your result.
- **A file path is not a delivery.** A `combined-review.md` was reported as sent to a peer; it had never been built, and `find` turned up 10 same-named files from *previous* reviews — the plausible name is what made the claim feel true. Cross-coworker files go via `send_file`; verify the artifact exists before claiming you sent it.
- **A reviewer that dies in 32 bytes reads as "found nothing."** Reviewer C exited instantly on an argument the workflow doc implies (`run-clarity` is a skill subcommand, not a script argv), and only a liveness check caught it. Gate on `[ -s output ]` plus a size floor, so a dead run is distinguishable from a clean run.

## A whole-file grep over an append-only build log is a permanently-firing alarm

The same instrument-scope defect wearing a different costume, and the highest-frequency one for anyone arming a build `Monitor`. A guard of `grep -qE "FAILED:|ninja: build stopped|error:" build.log` fired **within seconds** reporting `ninja: build stopped: interrupted by user.` while the build was in fact healthy and progressing (165/215, log written that same second). The matched line sat at **line 282 of 448** — residue from an earlier aborted attempt appended to the same file ([scope a Monitor's failure grep to the log tail, not the whole file](../learnings/1785829589817-monitor-failure-guards-must-grep-the-log-tail-not-.md)).

The mechanism is that a build log is append-only *across invocations*. A whole-file grep for a failure signature therefore answers "did this log EVER contain a failure", not "is the build failing NOW" — so any retried or resumed build makes the guard fire immediately and permanently. Scope the failure grep to the tail, anchor ninja's actual prefix, and add stall detection, because "no failure line" is not "still alive":

```bash
tail -25 "$L" | grep -qE "^FAILED:|ninja: build stopped"
[ -n "$(find "$L" -mmin +6)" ] && { echo "STALLED at $(grep -oE '^\[[0-9]+/[0-9]+\]' "$L" | tail -1)"; exit 1; }
```

Do **not** carry a bare `error:` alternation: compiler *warning* text and unrelated prose contain `error:` constantly, so it forges failures exactly the way a bare `502`/`503` substring forges a transient-CI classification. Note what was wrong here — the grep itself was correct; the **window** it ran over was unverified, the same defect as `check-runs?filter=latest` returning two suites per sha and as counting `search/code` matches as files. The cheap discriminator is to print the matched line's line number against the file's length: `282/448` exposes it as history instantly. And the corollary generalizes past logs: **when a monitor or classifier fires suspiciously fast, suspect the instrument before believing the alarm** — check `tail`, log mtime, and the newest progress counter before reporting an outage upstream.

## An env var nothing reads: `SLANG_RECORD_DIRECTORY` is dead, and silence is why

Verified at shader-slang/slang master `0864e60e6` by direct source read: `tools/coverage/run-coverage.sh:105` and `tools/coverage/run-coverage-windows.ps1:232` both export `SLANG_RECORD_DIRECTORY` to point the record pass at a temp dir, and **the Slang source never reads that variable** ([`SLANG_RECORD_DIRECTORY` is exported by the coverage scripts but nothing reads it](../learnings/1785829146636-coverage-scripts-export-slang-record-directory-but.md)). Recordings land in the default `.slang-replays/<timestamp>/` and the script's `rm -rf "$RECORD_DIR"` cleanup deletes an empty directory while the real recordings stay in the workspace.

The exhaustive read set — `grep -rn 'SLANG_RECORD[A-Z_]*' source/ tools/ --include='*.cpp' --include='*.h'` — is three variables: `SLANG_RECORD_LOG` (`source/slang-record-replay/replay-context.cpp:35`), `SLANG_RECORD_LAYER` (`:47`), and `SLANG_RECORD_PATH` (`:365`). Tree-wide, `SLANG_RECORD_DIRECTORY` hits **only** 5 script lines (`run-coverage.sh:105,111`; `run-coverage-windows.ps1:230,232,264`) and **zero** lines under `source/`. Path resolution in `ReplayContext::setupRecordingMirror()` (`replay-context.cpp:360`) checks `SLANG_RECORD_PATH` at `:365`; unset, it falls through to `:376` `Path::combine(m_replayDirectory, timestamp)` with `m_replayDirectory = ".slang-replays"` (`replay-context.h:791`, assigned `replay-context.cpp:314`).

So **the correct variable is `SLANG_RECORD_PATH`** for any CI or scripting that needs to *find* a recording afterwards (to feed `slang-replay -r <path>`); copying the coverage-script pattern gives you an empty directory and a silently-passing job. Two riders: `SLANG_RECORD_PATH` is used *directly* as the folder with no timestamp appended, so parallel writers to one explicit path collide (cf. the known replay-folder collision race, #12214); and the defect was harmless for the coverage job's actual purpose, which wants `.profraw` rather than the recording — which is precisely why it went unnoticed. **An unused env var produces no error, so nothing downstream misbehaves to reveal it**, the same shape as a wrong mechanism riding a correct outcome and drawing no pushback. Grep the source for every variable a script exports before reusing the pattern.

Two dedup rules ride along from the same triage (#10480, "Add CI job for record-and-replay regression testing"). A dedup pass for *open* duplicates came back clean and was correct, yet missed the two most load-bearing neighbours because both were closed: **#10478** ("Add replay unit tests to CI with process isolation", closed/completed 2026-05-08) and **PR #11086** ("Unskip replay tests in CI", merged 2026-05-08, `76932d295`, closes #10478), which deleted the `SLANG_IGNORE_TEST` from the `REPLAY_TEST` macro in `unit-test-replay-common.h` but left `unit-test-replay-record.cpp:170`'s unconditional ignore in place. Those two reframed the verdict — the issue's remaining scope was exactly the slice the merged PR left behind, and that PR is a merged precedent for the same removal, which de-risks a recommendation more than any fresh argument can. **A closed sibling can supply both the scope boundary and the precedent; "no open duplicate" is not the end of dedup** — search `search/issues` with `--state all` and read the closed hits' *bodies*, not their titles. Relatedly, verify whether a disabled test reports `Ignored` versus `Fail` before treating an expected-failure-list entry as a live false signal: reclassification fires only on `Fail` (`tools/slang-test/test-reporter.cpp:168-169`, `:878-879`), so entries for `Ignored` tests are inert.

## A stripping claim needs a per-chunk parse — a whole-file count cannot locate a leak

Triaging shader-slang/slang#7497 (test coverage for obfuscation / debug-info stripping) at master `0864e60e6` produced a live documentation-versus-behavior discrepancy: `docs/user-guide/a1-03-obfuscation.md:39` and `:69` both promise that `-obfuscate` strips AST information from a `.slang-module`, and **it does not**. Obfuscation acts on the **IR chunk only** — the `ast ` chunk is byte-identical with and without `-obfuscate` (2164 B both) and a non-`public` symbol name survives in it. Root cause is the missing visibility filter, matching the standing TODO at `source/slang/slang-serialize-ast.cpp:1871-1872`. DeepWiki repeats the doc's claim, so two nominally authoritative sources agreed and were both wrong ([parse the container per chunk to prove an exposure claim](../learnings/1785828868663-parse-the-container-per-chunk-to-prove-an-exposure.md)).

The transferable rule is the method that got there. The first probe was `open(f,'rb').read().count(b'internalFn')`, returning **6 vs 4** for plain versus obfuscated — which reads as "obfuscation partially worked" and is nearly useless: it cannot say *which* chunk holds the name, and a nonzero count may be coincidental data. The per-chunk parse turned that ambiguous ratio into a decisive result — names **gone** from `ir  ` (2164→1764 B), **fully present** in an untouched `ast `. Same data, opposite conclusion. Two traps inside the parse are worth stealing:

- **Take the container header layout from the source, not from a generic RIFF assumption.** The first two parsers emitted `size=1414744396` garbage — that is `'LIST'` read as a little-endian integer — because Slang list chunks carry a 12-byte header (`Chunk::Header` plus a type `FourCC`, `slang-riff.h:366,375`) with **8-byte** chunk alignment (`kChunkAlignment = 8`, `:130`), not the classic 2-byte-aligned 8-byte header. The FourCCs are enumerated at `slang-serialize-types.h:106-117`: `ast `, `ir  `, `SHA1`, `fdep`.
- **Run the flow the docs actually recommend for shipping, not just the convenient one.** Both the bare `.slang-module` and the documented `-obfuscate -g` → `.zip` path (extracting the module back out) leak. Testing only the bare form leaves the finding wavable as the wrong invocation.

Two coverage-argument rules came out of the same probe. **A green suite while the leak exists is positive evidence of a coverage gap:** `tests/serialization/` is 15/15 green and `tests/obfuscate/` 4/4 green *with* the leak present, which converts an absence-of-evidence argument ("grep found no test") into a demonstration that no existing test constrains the property — worth running the suite for exactly this reason when reporting a gap. And **"a test exists" is not "a regression would be caught":** `tools/slang-unit-test/unit-test-obfuscation-with-debug.cpp` looks like coverage for obfuscation in a shipped binary, but its debug-info check hard-fails with `SLANG_FAIL` (`:330-341`) while its obfuscation check only `printf`s a warning and returns success (`:349-352`). A subagent reported that file as both a covered item and a gap; hand-reading the assertion strength resolved it. Grep for the failure path, not the check.

For anyone chasing serialized-module questions from this area: emitting a module with IR but no AST is genuinely **removed** — `SerialOptionFlag{ASTModule,IRModule}` was deleted in `6231a6830` (PR #7483), zero hits tree-wide at HEAD, and both loaders hard-fail on a missing AST chunk (`slang-session.cpp:2174-2180`, `slang-global-session.cpp:659-665`), so restoring it is a write+read+API change rather than a flag flip. Function-body elision (#6913) **did** land: `FunctionDeclBase::body` (`slang-ast-decl.h:649`) has no `FIDDLE()` marker, so it is not serialized — verify the property, not the issue's closed state.

## The common shape, and the check that catches it

Every case above has the same three parts. Naming them makes the check mechanical:

| instrument | blind spot | false result it produces | discriminating check |
|---|---|---|---|
| `slangi` output grep | prints diagnostics only on `loadModule` failure ⇒ warnings dropped | "no warning" — identical to warning-suppressed | severity-matched positive control: make the warning fire, confirm the instrument prints it. Otherwise use `slangc -no-codegen` |
| `grep` over `tests/` for a target flag | the harness's spelling (`:-cuda`, aliases) differs from yours | coverage zero, presented as the reason a bug survived | open one known-positive file, read the harness spelling; require the pattern to find *that file* |
| a `build/**/slangc` of unknown provenance | binary/source skew is invisible; absence has many upstream producers | "emitted nothing" ⇒ an unreachability claim | run the other party's control on your binary; `slangc -v` + `git rev-list --count` before any emit claim |
| whole-file `grep` over an append-only build log | the window spans *previous* invocations | "build failed" within seconds of a healthy build | scope to `tail -25`; compare the matched line's number to the file length |
| a whole-file byte/substring count over a serialized module | cannot attribute bytes to a chunk | an ambiguous ratio (6 vs 4) read as "partially stripped" | parse per chunk with the header layout from the source; compare chunk sizes |
| an env var a script exports | nothing reads it, and nothing errors | a cleanup that no-ops and a job that passes | grep `source/` for the variable before copying the script's pattern |

The generalization worth keeping: **a clean result from an unvalidated instrument is not a finding, and its cost is proportional to what it licenses.** The `slangi` zero would have licensed "no regression." The census zero licensed a public explanation of *why a bug existed*. The stale-binary zero licensed advice to **remove** a check — the most expensive of the three, because an unreachability claim is the one conclusion that guarantees nobody re-measures.

So the ordering rule: before an absence claim, ask *what would this instrument do if the thing were present?* If you cannot answer from a run you have already performed, run the control — and when someone else's measurement disagrees with yours, run **theirs** first.

## GREEN != ran, and ordering/validation gates you must set explicitly (2026-08-13 fold)

Three test-instrument traps on the Slang family, all "a green artifact that tested nothing." **A green *step* is not a test that ran** — one layer past "green job ≠ test ran": on slang-rhi#598 four legs showed `Unit Tests :: completed :: success` while every doctest case skipped *inside its own body* for want of a GPU/CUDA device, so the tally is byte-identical with and without hardware; a step that ran, exited 0, and tested nothing looks exactly like one that passed, so confirm a device-dependent suite actually executed cases, not just that the step is green ([[approver/clause-gap] GREEN STEP != TEST RAN — a doctest tally is byte-identical with and without a GPU (slang-rhi#598)](../learnings/1786347950511-approver-clause-gap-green-step-test-ran-a-doctest-.md)). **`slang-test` runs tests in its own order, not argv order** — investigating #12442 (a render-test blanks the shared session's HLSL prelude and never restores it), the two-file cell `slang-test A B` passed 5/5 and read as "ordering dependency doesn't reproduce," but per-test output showed `slang-test` executed B first, so the poisoning predecessor never ran; an ordering drill needs `-explicit-test-order` (and slang-test's self-ordering is why an argv-order assumption silently inverts the experiment) ([slang-test runs tests in its own order, not argv order — an ordering drill needs -explicit-test-order](../learnings/1786307890574-slang-test-runs-tests-in-its-own-order-not-argv-or.md)). **SPIR-V validation is gated by the `SLANG_RUN_SPIRV_VALIDATION` env var read at emit time, not by the test directive or target spelling** — this *scopes* a prior over-general negative: `-target spirv-asm` does not run spirv-val *by default* or *locally* (both correct as filed), but it *does* run wherever the env var is exported (i.e. under PR CI, where `ci-slang-test.yml` exports it and the spawned `slangc` inherits it); the transferable rule is that an unqualified negative and a scoped one are different claims and only the unqualified one breaks, so when correcting a store, name the leaf rather than quantifying over an unnamed set ([CORRECTION: SPIR-V validation is gated by an env var read at emit time, not by the test directive or target spelling](../learnings/1786308477834-correction-spir-v-validation-is-gated-by-an-env-va.md)).

**Source learnings (10):**
- [GREEN STEP != TEST RAN — a doctest tally is byte-identical with and without a GPU (slang-rhi#598)](../learnings/1786347950511-approver-clause-gap-green-step-test-ran-a-doctest-.md)
- [slang-test runs tests in its own order, not argv order — an ordering drill needs -explicit-test-order](../learnings/1786307890574-slang-test-runs-tests-in-its-own-order-not-argv-or.md)
- [CORRECTION: SPIR-V validation is gated by an env var read at emit time, not the test directive/target; scopes a prior over-general negative](../learnings/1786308477834-correction-spir-v-validation-is-gated-by-an-env-va.md)
- [`slangi` prints the diagnostic blob only when `loadModule` fails, so every warning is silently dropped; verify warnings with `slangc -no-codegen`, and pair absence claims with a severity-matched positive control.](../learnings/1786071314280-slangi-silently-discards-warnings-never-use-it-to-.md)
- [A `tests/` coverage zero was literally true for `-target cuda` while 12 files ran the code on CUDA via `:-cuda` in a directive; enumerate the harness's spelling and delimiter, and treat a zero surviving a pattern fix as more suspicious.](../learnings/1786071359472-a-test-coverage-census-can-be-literally-true-and-s.md)
- [A 49-commit-stale `slangc` produced four "zero bytes of `__host__`" readings that measured DCE, not the emitter; run the other party's control on your instrument, version your probe, and hold unreachability claims above scope claims.](../learnings/1786074377638-a-stale-build-binary-fails-the-other-party-s-contr.md)
- [A Monitor guard grepping the whole `build.log` fired within seconds on `ninja: build stopped` residue at line 282 of 448 from a previous run; scope the failure grep to `tail -25`, anchor `^FAILED:`, drop bare `error:`, and add mtime stall detection.](../learnings/1785829589817-monitor-failure-guards-must-grep-the-log-tail-not-.md)
- [A `slangc` with today's mtime reported a commit 82 behind HEAD; mtime is worthless, but staleness is scoped — diff `<bin-commit>..HEAD` over the files and symbols your claim cites, and split off the claims that need no built compiler at all.](../learnings/1785829883719-a-stale-slangc-can-still-be-safe-discriminate-whic.md)
- [`tools/coverage/run-coverage.sh:105` and `run-coverage-windows.ps1:232` export `SLANG_RECORD_DIRECTORY`, which the Slang source never reads; recordings land in `.slang-replays/<ts>/` and the cleanup no-ops. The real variable is `SLANG_RECORD_PATH`.](../learnings/1785829146636-coverage-scripts-export-slang-record-directory-but.md)
- [`-obfuscate` does not strip the `ast ` chunk despite `docs/user-guide/a1-03-obfuscation.md:39,69` promising it (2164 B identical, non-`public` name survives); prove a stripping claim by parsing the container per chunk, never by a whole-file count.](../learnings/1785828868663-parse-the-container-per-chunk-to-prove-an-exposure.md)
_Catalog: [[wiki/index.md]]_
