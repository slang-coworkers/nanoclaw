# An unpinned test assertion can be MASKING a live defect — and verifying a diagnostic's label is not verifying its effect

I delivered a **0-bugs** verdict on shader-slang/slang#12353 and it was **wrong**. The change contained a real bug; the author found it after my 69KB report shipped, past four reviewers (three corroborating). Every other measurement defect that night was caught before reaching a conclusion — this one shipped inside a delivered verdict.

## The bug

The PR added a branch in `createArtifactFromIR` (`source/slang/slang-emit.cpp`) that diagnoses a new `error` when the SPIR-V validator is unavailable — then **fell straight through**: no `return`, no error-count consult. The artifact was published and `getEntryPointCode` returned **`SLANG_OK` with SPIR-V that nothing had validated** — exactly the outcome the PR body argued its `err` severity existed to prevent.

Mechanism, verified from source: `source/compiler-core/slang-diagnostic-sink.cpp` throws only at `severity >= Severity::Fatal` (`:619`, `:696`, `:822`). `Severity::Error` merely does `m_errorCount++`, and the SPIR-V emit path never reads that count. The *previous* code accidentally worked because it used `internal(..., 99999, ...)`, which aborts.

## Lesson 1: verifying a diagnostic's LABEL is not verifying its EFFECT

I traced `shouldRunSPIRVValidation` to prove the diagnostic was opt-in-only, and quoted `getSeverityName` to argue `err` was the right *severity* over `warning` — a genuinely careful analysis of **what the diagnostic is called**. I never asked the next question: **does an `error` actually stop this path?**

The adjacent question had a satisfying answer, and that is what stopped the next one from being asked.

**Rule: severity is a rendering property, not a control-flow one.** When a change relies on a diagnostic to *prevent* an outcome, trace the control flow after the `diagnose()` call and name what actually halts execution. In Slang specifically: only `Severity::Fatal` and above abort; `Error` just increments a counter that a given path may never consult.

## Lesson 2: an unpinned assertion may be masking a bug, not merely failing to catch one

A peer reviewer found: *"nothing pins the new diagnostic's severity or code — flipping `err(` to `warning(` leaves all four tests green."* I verified that mutation claim, confirmed it, and filed it as a **test-coverage gap**.

It was more than a gap. The tests couldn't detect a severity change **because the severity already had no effect on that path**. The unpinned assertion and the live defect shared one root cause, so the "coverage gap" was a symptom pointing at *code*, not at *tests*.

**Rule: when a mutation leaves every test green, don't stop at "add an assertion." Ask why the mutation is invisible.** If the answer is "because the mutated property doesn't affect this path," you have found a bug. Escalate a coverage gap to a bug candidate whenever the unpinned property *is the mechanism the change depends on*.

## Meta

Both lessons are the same shape as the family that produced six defects across four agents that night — trusting a check adjacent to the claim as if it were the claim. The difference is where it landed: the others were caught in-flight; this one reached a published verdict and was found by the author. A high-volume, multi-reviewer, heavily-corroborated review is not protection against the one question nobody asked, and confidence from corroboration is worth less than one unasked question is worth.
