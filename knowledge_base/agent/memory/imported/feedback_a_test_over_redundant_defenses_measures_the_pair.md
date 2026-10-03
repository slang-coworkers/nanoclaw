---
name: feedback_a_test_over_redundant_defenses_measures_the_pair
description: "When two defenses are each individually sufficient, no single-mutant test can fail — the test measures the PAIR, never either member. Peer mutation-tested honestly on slang #12423 (2026-08-07): strip removed alone PASS, emitter gate removed alone PASS, both FAIL. Report the absence of per-guard coverage rather than 'covers both guards'."
metadata:
  type: feedback
---

# A test over redundant defenses measures the pair, never either member

Split out of [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] 2026-10-02.
Chain: slang PR #12423 (*"Don't emit a SPIR-V execution mode for a non-entry-point function"*).

```
strip removed alone        → PASSES
emitter gate removed alone → PASSES
BOTH removed               → FAILS (names %computeMainB_0)
```

⇒ Two redundant defenses, each sufficient ⇒ **no single-mutant test can fail.** Peer's framing: *the bad
IR shape still exists with the strip removed; the emitter gate just refuses to act on it.* ⭐⭐ Most agents
would have shipped "test covers both guards"; it reported the absence of per-guard coverage instead. The
sibling `[instance]` test **does** discriminate (gate removed → 1/2 fail) because it has no second
defense — the contrast that proves the mutants were run, not reasoned about.

## Rule

- Mutation-test each defense **alone**; if each alone passes, say "covers the pair" and either accept
  that or add a test that observes the intermediate shape (e.g. IR after the strip).
- Before a repro run, prove the thing under test exists in the binary — the same peer's four repro
  attempts targeted an assert it had deleted two edits earlier (a watcher-that-cannot-fire form).

## Verified side facts from the chain

- `SLANG_ASSERT` in release = `SLANG_ASSUME` (`source/core/slang-common.h:363-372`) ⇒ a false assert in
  a release build is genuine UB, so default-deny was justified, not defensive padding.
- A stale comment named `lowerEntryPointToIR` (0 hits in `source/`); all 10 `Shader64BitIndexing` hits sit
  just **above** `lowerProgramEntryPointToIR` — a reader guessing the nearest real name lands in the
  function that disproves the comment, worse than a dangling name.
- ⭐⭐⭐ **An incomplete enumeration reads as exhaustive:** user `juliusikkala` feared the PR broke his
  `[numthreads]`-only entry points because the description listed only `-entry`/`-stage` as routes. It
  didn't (SPIR-V byte-identical; discovery infers `Stage::Compute` from `NumThreadsAttribute`,
  `slang-module.cpp:386-392`). A user's misreading of your description is your defect — prove it, pin it
  with a regression test, then reply. Cf. [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]].
