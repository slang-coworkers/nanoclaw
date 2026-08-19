---
name: a-watcher-scoped-to-the-known-hazard-reports-silence-as-all-clear
description: "A monitor triggered on last week's failure signature stays silent through this week's red, and its silence reads as \"0 failures\" — trigger on ANY non-success, then branch to the specialized discriminator."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-05, slang PR #12353.** I warned two peers about a SLANGWIN5 SPIR-V-validation confound. `slang-reviewer` built a pole-validated discriminator, armed it on `compile-regression` failures gated on `runner_name == "SLANGWIN5"`, and reported **"0 failures"** twice — at 22:14 and again minutes later. Both statements were already false: `test-falcor / Test (Falcor)` had failed on **SLANGWIN4** at **22:09:45Z**, before either message.

⭐⭐⭐ **The instrument was correct and validated; its TRIGGER SCOPE was the defect.** Both gate conditions missed (`test-falcor` ≠ `compile-regression`; `SLANGWIN4` ≠ `SLANGWIN5`), so a well-built watcher sat silent through the only red on the run — **and its silence was read as an all-clear.** A monitor aimed at the hazard you already know converts an unmonitored failure into confident false assurance. Worse than no monitor, which at least prompts a manual look.

⇒ **Fix: trigger on `conclusion != "success"` for ANY job, THEN branch to the specialized discriminator when the job matches its scope.** Selectivity belongs in the classifier, never in the trigger.

⭐⭐ **The priming symmetry is the reusable half: I flagged the hazard I had been primed for, and the actual failure arrived where neither of us was watching.** Yesterday's outage set both our attentions on SLANGWIN5/compile-regression; the red came from SLANGWIN4/test-falcor. **Detection aimed at the last failure is not coverage of the next one** — a fresh hazard flag narrows attention as much as it directs it. Sibling of [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]: here the consumed reason-to-look was *"the watcher would have told me."*

⭐⭐ **A binary infra-vs-real label set cannot express "real but unrelated," and forcing it corrupts the verdict.** INFRA / REAL / INDETERMINATE had no slot for this failure: a process genuinely crashed, and it is **not attributable to the diff** (reachability). Forced to REAL it implicates the maintainer's PR; forced to INFRA it blames the environment. **A label set needs a slot for every outcome the evidence can actually produce** — add UNRELATED-TO-DIFF, carrying its reachability argument. With a human watching a red X, the label is what gets acted on. ⛔ **I originally wrote "not infra" as established. Withdrawn — unsupported, and a `0xC0000005` host access violation on a Windows runner is a PARADIGM infra suspect.** Whether it is infra or a genuine unrelated defect is **undetermined**, and that is precisely why the fourth slot is needed: it lets you report *not-the-diff* without pretending to have resolved infra-vs-real. ⚠️ **Excluding a category the same note calls unprovable is the error** — I did it two lines from the sentence conceding the logs had expired.

⭐⭐ **Reachability is the only decisive KIND of argument here, and it supplies TWO independent legs.** (1) `createArtifactFromIR` **opens** with `SLANG_RETURN_ON_FAIL(emitSPIRVFromIR(...))` at `slang-emit.cpp:3291` — SPIR-V-only **by construction**, not by an internal branch, so a **D3D12/DXIL** test never enters it. (Cite the entry call, not "the branch is SPIR-V flavored" — the former is checkable in one read.) (2) `slang-fixer`'s: both changed branches require `needsValidation` **and** a non-OK `validate`, so nothing in the diff runs target-irrespectively.

⛔⛔ **THE SIBLING-ISOLATION ARGUMENT WAS AN OVERCLAIM.** I wrote that a regression "would not spare nine near-identical neighbours and kill one" (the real figure is **12 PASSED / 1 FAILED / 2 SKIPPED** — "nine" was never the measured count). **`slang-fixer` refuted it: an INPUT-SPECIFIC defect in shared code can hit one variant and spare its siblings** (different shader inputs take different paths through the same code). Isolation **localizes** a failure; it does not exonerate a shared code path. ⇒ ⭐⭐⭐ **"N siblings passed" is corroborating, never decisive — and it is the leg that FEELS strongest because the count is large.** Twelve greens read as twelve independent confirmations; they are one weak inference repeated.

⚠️ **I first recorded this as "I sent it to both peers, who repeated it back." That attribution is WRONG — see [[feedback_verified_fragments_do_not_verify_the_conclusion]].** The fixer formed it independently at 22:12:54 (their own review caught it 22:15:15) and my message carrying it arrived 22:19:50. **Two convergent origins, not one origin plus propagation** — and I got that wrong in the direction of taking *more* blame, which is the direction I never thought to verify.

⛔ **Also NOT established: "known flake."** Only prior `test-falcor` failure on `ci.yml` is run `29742458336` from 2026-07-20, logs expired ⇒ unprovable. Fixer independently reached the same limit from the other side (Falcor `success` on the two recent master runs where it ran; no red-master control). **State the limit rather than let "probably flaky" ride on the reachability claim's strength.** Crash profile (`3221225477` = `0xC0000005` host access violation, not a golden-image mismatch) is likewise corroborating only.

See [[technique_spirv_val_infra_discriminator_measured_both_poles]] for the discriminator itself and [[project_12342_downstream_absent_capability_slangresult]] for the chain.

## ⭐⭐⭐ THREE DISTINCT FORMS OF "A WATCHER THAT CANNOT FIRE", all 2026-08-06/07 — and each was silent, not broken

| form | mechanism | how it was caught |
|---|---|---|
| **wrong trigger scope** | armed on `compile-regression`+`SLANGWIN5`; the red landed on `test-falcor`+SLANGWIN4 | a peer measured the run and found the failure the watcher never saw |
| **unfireable predicate** | `gh api --jq` prints its **error object to stdout**, so `[ -z "$CTL" ]` is unreachable — and `\|\| echo 0` pins a count to 0 forever | a control that SHOULD have fired didn't |
| **self-matching process watch** (peer's) | `until ! pgrep -f run-clarity` can never exit: the monitor's own command line contains `run-clarity` | read the run log's `done (rc=0)` instead and found the job had finished at 07:40 |

⇒ ⭐⭐⭐ **All three are indistinguishable from "the job hasn't finished yet."** A watcher's silence is only evidence if the watcher can be shown to fire — **so every armed guard needs a must-fire control at arming time, not at doubt time.**

⭐ **FOURTH FORM, 2026-08-17 (slang-fixer, PR #12555) — a RESULT-COUNTING grep whose alternation omits a failure signature.** Not a monitor, same class: the fixer's autodiff-failure grep matched `CHECK`/signature-mismatch strings but **not `SIGSEGV|server killed`**, so **8 hard compiler crashes sat in the logs, filtered out of the count.** It reported "2 signature files" when 8 were deterministic SIGSEGVs — the 97% aggregate was right, the *characterization* was wrong. ⇒ same remedy as the [Monitor] tool's coverage rule: **a filter must enumerate EVERY terminal failure signature (crash + kill + assert + timeout), not just the happy-path/known one** — ask "if this crashed right now, would my filter emit anything?" The fixer caught it itself on a careful re-check and corrected the count before reporting to the maintainer — the right order. Recorded in [[project_12430_pr12555_existentialtype_saga]].

⭐⭐⭐ **PEER'S FIX IS THE GENERAL ONE AND BETTER THAN MINE: WATCH THE ARTIFACT, NOT THE PROCESS.** `until [ -s clarity-review.md ]` rather than `until ! pgrep -f <job>` — **the output file is the thing that actually matters, and a process can die without producing it.** (Their earlier instance of the same defect: a bare `pgrep -f run-clarity` reported "C RUNNING" when the only matches were their own grep processes; caught by checking `/proc/<pid>/cwd` and finding it pointed at their verification worktree.)

✅ **Fleet audit prompted by their report: NONE of my guards watch a process** (`pgrep`/`pidof`/`ps -ef` → 0 hits across all six). All three live ones poll artifact-or-API state — `i12371-pr-guard.sh`, `pr12200-guard.sh`, `sweep12375-guard.sh` — which is the shape their finding argues for. **Checked rather than assumed, because "I would never do that" is not a measurement.**

## ⭐⭐⭐ A TEST OVER REDUNDANT DEFENSES MEASURES THE PAIR, NEVER EITHER MEMBER (2026-08-07, slang #12423)

**A peer mutation-tested its own new test honestly and reported that it does NOT discriminate:**
```
strip removed alone        → PASSES
emitter gate removed alone → PASSES
BOTH removed               → FAILS (names %computeMainB_0)
```
⇒ **Two redundant defenses, each individually sufficient, so NO single-mutant test can fail.** Their framing is the one to keep: *the bad IR shape still exists with the strip removed; the emitter gate just refuses to act on it.* ⭐⭐ **Most agents would have shipped "test covers both guards" — they reported the absence of per-guard coverage instead.** The contrast case proves the mutants were actually run rather than reasoned about: the sibling `[instance]` test **does** discriminate (gate removed → 50%, 1/2) because there is no second defense there.

⭐⭐⭐ **FOURTH FORM OF "INSTRUMENT ABSENT": FOUR REPRO ATTEMPTS THAT WERE STRUCTURALLY INCAPABLE OF FIRING.** They had **already deleted the assert two edits earlier** while fixing a comment, so the runs could not reproduce an assert that no longer existed in the binary. Fixed by temporarily restoring it. ⇒ **To reproduce an assert, first prove the assert EXISTS in the binary under test** — a test that cannot fail is indistinguishable from a test that passed. (Forms so far: wrong trigger scope · unfireable predicate · self-matching `pgrep` · **absent assertion**.)

✅ **UB premise verified verbatim, so default-deny was justified rather than defensive padding:** `source/core/slang-common.h:363-372` — `#ifdef _DEBUG … handleAssert(…) #else #define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)`. **A false `SLANG_ASSERT` in a release build is genuine UB.**

✅ **Comment-fix claim verified at coordinates, and the sharper half holds:** `lowerEntryPointToIR` → **0 hits in `source/`** (name gone); `Shader64BitIndexing` in `slang-lower-to-ir.cpp` → **10 hits, all at :15281-15312**, while `lowerProgramEntryPointToIR` spans **:15316→:15372**. ⇒ **Every hit sits ABOVE the function, so a reader guessing the nearest real name lands in the function that DISPROVES the comment** — worse than a dangling name.

⚠️ **UNFILED, HARNESS-WIDE, and bigger than the PR: `slang-test` never gates on `exeRes.resultCode`, so a bare `CHECK-NOT` PASSES TRIVIALLY when the compile stops emitting.** ⇒ **Every `CHECK-NOT`-only test in the suite is potentially vacuous** — the same family as every item above, at suite scale. Told the peer to file it separately with the mechanism plus one demonstration, not folded into #12423. **Public write ⇒ needs operator authorization; offered to raise it alongside the two filings already held.**

## ⭐⭐⭐ THE LARGEST INSTRUMENT-ABSENT CLASS FOUND SO FAR: an entire assertion type downgraded to `Ignored` as DOCUMENTED POLICY (slang-test, 2026-08-07)

**Peer's find, verified verbatim by me** — `tools/slang-test/slang-test-main.cpp:816-822`:
```cpp
IFileCheck* fc = context.getFileCheck();
if (!fc) {
    // Ignore if FileCheck is not available.
    // We could report an error, but our ARM64 CI doesn't have FileCheck yet.
    testReporter.message(TestMessageType::Info, "FileCheck is not available");
    return TestResult::Ignored;          // not Fail
}
```
⇒ **On any host lacking FileCheck, EVERY `filecheck=`/`filecheck-buffer=` test returns `Ignored`** — and the comment names **real ARM64 CI** as that host. *A test that cannot fail is indistinguishable from a test that passed*, here as harness policy with a TODO on it.

✅ **I MEASURED THE AGGREGATION BEFORE ANYONE CHARACTERIZED IT, and it cuts both ways:**
```
test-reporter.cpp:407-411  if (m_verbosity < Info) if (result==Pass || result==Ignored) return;  ← suppressed WITH Pass
test-reporter.cpp:362      if (result==Ignored && m_hideIgnored)                                 ← separate hide flag
test-reporter.h:148        bool m_hideIgnored = false;                                           ← defaults to NOT hiding
```
⇒ **"Silently SKIPPED, not silently PASSED."** At default verbosity it prints nothing (grouped with `Pass` for suppression), **but it is NOT tallied as a pass** — `Ignored` has its own `TestResult` and its own reporter cases (`:393`, `:427`). ⭐⭐ **Filing the stronger "counted green" version would die to a thirty-second `grep 'case TestResult::Ignored'`** — the precise cost the peer held the first filing to avoid. **Claim the version the code supports, not the version that lands hardest.**

⛔ **AND MY OWN "CONSEQUENCE 1" WAS WRONG — retracted, peer-caught.** I argued the result code is *"checked by comparison rather than by an `if`"* because `getOutput` embeds `result code = N`. But `slang-test-main.cpp:963-968` is a **ternary**: `defaultExpectedContent` reaches only `_fileComparisonTest`, so **in `filecheck=` mode nothing asserts on the code at all.** My mechanism holds for `.expected`-file tests and **is inapplicable to exactly the tests the finding concerns.** ⇒ ⭐⭐ **Reading the FORMATTER (`getOutput`) told me what data exists; only reading the DISPATCHER (`_validateOutput`) told me whether anything CHECKS it.** Data present ≠ data asserted.

⭐⭐⭐ **THE N-RULE, in the peer's stronger form: put the number of inspected instances in the claim EVEN WHEN IT'S LARGE, because a claim carrying its own N invites the reader to check the denominator.** This exchange is the argument for it — **three of my consecutive published statements needed narrowing** (suite-wide → one runner → not-even-that-mechanism), and each would have carried its own correction had it stated N. Their original error: inspected **N=1** runner, quantified over the harness.

✅ **Right instinct, right order (peer's, self-flagged): check your OWN artifact before worrying about the suite.** Their two tests carry `PRESENT`/`PROMOTED` positives beside the `CHECK-NOT`, so **the anti-vacuity directive added for another reason already covers this defect.** ⇒ **A positive directive is what makes a negative one meaningful, independent of harness behaviour.**

## ⚠️ A PEER RETRACTION CAN BE STALE — and re-verifying beat deferring to it (2026-08-07, slang-test gates)

**A peer sent a retraction at 09:44 that reverted two readings they had themselves corrected at 08:42/08:44.** It re-listed `:2319` as a `resultCode` gate and concluded *"nothing to file against the harness"* — which would have made me drop a measured finding I hold the filing for.

✅ **Re-verified instead of deferring, and the earlier work stands:**
```
:2319  if (exeRes.resultCode != 0)  actualOutput = getOutput(exeRes);   ← SELECTS output
:2324  else { … return TestResult::Fail; … }                            ← the Fail is INSIDE the else
       ⇒ it fires when the compile SUCCEEDED and the RUN failed; the resultCode path never fails the test
```
⇒ **`:2319` is an output selector, not a gate** — the peer's own 08:42 reclassification was right, and the 09:44 message regressed to the pre-08:42 reading.

⇒ ⭐⭐⭐ **DEFERENCE TO A RETRACTION IS STILL DEFERENCE. A peer withdrawing a claim carries social weight ("they're being rigorous"), so it is the update least likely to be checked** — the mirror of the earlier finding that *a disconfirming probe deserves MORE scrutiny than the original assertion*. **Verify a retraction against the timeline of the peer's own measurements: a later, better measurement outranks an earlier framing even when the earlier one arrives second.**

⭐⭐ **Diagnostic that settled it cheaply: compare the retraction against the peer's OWN prior findings, not against my beliefs.** Their 08:44 message contained `:977 forceFailure`, `:2760 /*forceFailure*/ false`, `:3781` gating, and the in-source `CROSS_COMPILE` rationale — a harness-level finding the 09:44 message discarded in favour of a per-test convention. **A retraction that throws away the sender's strongest evidence is a signal the retraction is stale, not that the evidence was wrong.**

⭐⭐⭐ **The genuinely new item from that exchange, and a good rule: AN INCOMPLETE ENUMERATION READS AS AN EXHAUSTIVE ONE.** A user (`juliusikkala`) feared the PR broke his `[numthreads]`-only compute entry points **because the PR description listed only `-entry`/`-stage` as routes by which a `[shader]`-less function becomes an entry point.** It didn't break — emitted SPIR-V byte-identical to master, mechanism at `slang-module.cpp:386-392` (discovery infers `Stage::Compute` from `NumThreadsAttribute`). ⇒ **A user's misreading of your description is your defect, not theirs** — and the fix order was right: prove it, then pin it with a regression test, then reply.
