---
title: "A zero without a positive control applies to INSTRUMENTS and HARNESSES too, not just searches — and nest the control one step from the discriminator"
type: learning
topic: misc
source: learnings/1785874011041-a-zero-without-a-positive-control-applies-to-instr.md
---

# A zero without a positive control applies to INSTRUMENTS and HARNESSES too, not just searches — and nest the control one step from the discriminator

**Where this came from:** slang#12343. I hold the rule *"a zero without a positive control is not a finding"* for searches/greps. In one session I violated it twice in forms I didn't recognise as the same operation.

## 1. Instrumentation — a single-counter probe's zero is ambiguous three ways

I added a probe counting "children left in `successor` with live uses at deallocation" and got `0`. That zero cannot distinguish: **(a)** the shape is safe, **(b)** the shape never occurred in the corpus, **(c)** the probe was never reached. Byte-identical output for all three.

**Fix — graduated counters, with the control NESTED one step from the discriminator:**
```
merges              = total merges observed          (distant control: "did it fire at all")
hoistableParamUser  = merges where a hoistable child consumes >=1 target param
twoParamShape       = ... consumes >=2               (the discriminator)
leftoverWithUses    = the actual question
```
`merges > 0` only proves *some* code ran. **`hoistableParamUser > 0` proves the probe reaches the *family* the question is about** — one step short of the shape being tested. That converts a `twoParamShape == 0` from "maybe my probe is misplaced" into "the probe demonstrably sees this family; no member has two." **A distant control and a nested control are not interchangeable.**

Also record *when* you sample: my counter sampled **before** the first mutation, which is what made it able to observe the pre-merge state at all. Sampling after would have read 0 for a structural reason unrelated to the answer — and would have looked identical.

## 2. Harnesses — my sweep reported `merges=0` having measured NOTHING

I swept 400 files with `slangc <f> -target hlsl -o /dev/null` and reported `merges=0` as a corpus-wide negative. **Every invocation had failed** with `error[E00070]: the output path '/dev/null' is not associated with any entry point` — `-o` requires `-entry`. Zero files reached the pass under test. Re-run correctly (drop `-o`): **473 merges across 66 of 250 files**.

The rule was fresh in my mind — I had just built the nested control that saved the probe — and it still didn't transfer, because **a harness doesn't present itself as "the kind of thing that needs a control."** A probe feels like an instrument; a for-loop feels like plumbing. Both are instruments.

**Cheap guard:** make your harness print how many invocations *succeeded*, not just the aggregate. `66 of 250 produced a summary` is informative; `merges=473` alone is not, and `merges=0` alone is actively misleading.

## 3. When NOT to run a control: an underpowered one launders rather than exonerates

A `compute` suite run core-dumped once; 4 subsequent full runs were clean. Tempting move: run master N times, report "master: 0 crashes in N runs, therefore unrelated." At a ~1-in-11 rate, **~6 runs have roughly a 60% chance of showing zero crashes even if the rate is identical.** That control establishes nothing while *reading* as exoneration. I declined it and disclosed the unattributed crash instead. Do the power arithmetic before running a control; a control you can't interpret is worse than none.

## Related instrument-domain traps hit in the same session

Each is a well-formed reading of the *wrong question* — the failure isn't carelessness about facts, it's not asking whether the instrument's domain includes the claim:
- **`$?` for `slang-test`** — it exits 0 even when tests fail. Parse `FAILED test:` lines.
- **`command -v <tool>`** for availability — reports ABSENT for a pip-installed tool in `/home/node/.local/bin` (off PATH). The tool exists; the check says no.
- **`git diff --stat` for "my change"** — blind to **untracked** files, in both plain and `HEAD` forms. My new regression test showed as `??` while the diffstat said "1 file"; `git commit -am` would have shipped the fix with **no guard**. Use `git status --short`, or `git add` then `git diff --cached --stat` and assert the file count.
- **`pgrep -f '<pattern>'` in a waiter** — the pattern matches the waiter's own command line, so `until ! pgrep -f ...` never exits. My rebuild silently never started.
- **`ls` after `cp`** — I wrote "this is a NEW file, not an overwrite" while the `ls` proving it ran *after* the copy. A check that runs after the destructive step verifies nothing.
- **A near-miss can be an identity.** My counter sat at exactly 2192 mid-run, matching the suite's headline total; I called it coincidence and predicted it would exceed. It *converged*, because `slang-test`'s own denominator counts the same thing my grep counted. **First hypothesis for a suspicious coincidence should be "these are the same measurement," not "contamination."**
- **Units before discrepancy.** "2192 entries" vs "2192 files" are different quantities. State the unit with every number: *"N `passed test:` entries across M test files"*. And note `entries != .slang files`: `tests/bugs/` has 638 entries over **377** test files = 371 `.slang` + 6 `.hlsl`. My own "fix" for a units error re-broke it by collapsing only `.slang.N` suffixes and leaving `.hlsl.1`/`.hlsl.2` as separate files.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785874011041-a-zero-without-a-positive-control-applies-to-instr.md`_
