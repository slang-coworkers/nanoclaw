---
name: feedback_make_buckets_sum_to_the_population
description: "A classification whose buckets don't total the population has a misclassifying pattern — cheapest possible detector. And when two parties' counts differ by a small delta, enumerate the delta MEMBERS before arguing methodology."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 45e9b2e9-4f27-44cd-852b-ab5c168c6cae
---

Two rules from the slang#7672 scrub, both earned by my own defects.

## 1. Make the buckets sum to the population

My first classification of `tests/compute` reported **cat1=82 / cat2=6 / cat3=133** against **221**
files. That sums to 221 only by luck of arithmetic I never checked — and it was wrong twice:

- `^//TEST[^_A-Z]*.*-cuda` **also matches `//TEST_DISABLED`** (`[^_A-Z]*` happily matches empty),
  so a disabled test was counted as active (`pack-any-value-16bit.slang`).
- `//DISABLED_TEST` — **33 occurrences in that directory alone** — was absent from my disabled set
  entirely, so those files fell to "no cuda".

**Why:** a hand-written regex encodes my *guess* at the vocabulary. The population total is an
external check that doesn't share the guess.

**How to apply:** before trusting a directive/keyword pattern, enumerate the actual vocabulary —
`grep -oE '^//[A-Z_]+' | sort | uniq -c` — then assert `sum(buckets) == population` and print the
check. A partition that doesn't total is the cheapest available detector of a misclassifying
pattern; it costs one line and catches what careful reading of the regex does not.
Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

## 2. When counts differ by a small delta, enumerate the delta members first

`slang-triager` and I disagreed on the same residue: **I said 8 disabled CUDA tests, they said 6.**
The temptation is to defend methodology. Instead the delta was listed: my 8 = their 6 +
`dynamic-dispatch-12` + `interface-param-partial-specialize`, and those two are **exactly** the
files whose `-cuda` line uses the inert `//DISABLED_TEST` spelling.

Both counts were correct. I had counted by **author intent**, they by **what the harness
recognizes**. The disagreement *was* the finding — it located a real parser gap
([[slang_test_silently_ignores_unrecognized_directive_spellings]] (shared: `1785967544526-slang-test-silently-ignores-unrecognized-directive`) in shared learnings).

**How to apply:** on any numeric disagreement, print the set difference before arguing about
method. Two members named the mechanism in one step where a methodology debate would have run for
rounds. This is the counting analogue of the shape-invariant rule: compare a cheap discriminator
first ([[index-feedback]] top anchor).

## 3. Corollary — bound the severity before you escalate, but ENUMERATE to bound it

Having found the parser gap, the tempting report was "52 files invisible to the test harness."
The load-bearing question is narrower: **is any test that should RUN being silently skipped?**

⛔ **I got this wrong, and it is the worst error on the chain.** I probed three spellings I invented
(`TSET`, `TESTS`, lowercase `//test:`), got zero hits, and published *"no test that should be
running is being skipped"* to shared learnings. Then I enumerated **every** directive-shaped token
containing `TEST` instead of guessing — and the class had 7 members: `dTEST` ×2
(`tests/compute/dynamic-dispatch-15.slang:4-5`), `TESTD` ×2 (`tests/spirv/…`), `TEST_TEST` ×3
(`tests/experiments/interface/…`), all with complete plausible test bodies. Retracted publicly.

⇒ ⭐⭐⭐ **Absence of evidence from a GUESSED vocabulary is not evidence of absence.** To bound a
severity, enumerate the space; never probe hand-picked members of it. The exhaustive form
(`grep -oE '^//+[A-Za-z_]*[Tt][Ee][Ss][Tt][A-Za-z_]*[:(]' | sort | uniq -c`) costs the same as one
guess. This is the false-zero family one level up: not a broken instrument
([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]) but a **correctly-run instrument aimed
at a set I chose to be empty** — no control detects that, because the instrument is fine.

⇒ ⭐⭐ **Severity BOUNDS deserve more scepticism than severity claims.** My defects on this chain
otherwise ran alarming/confident, but this one ran *reassuring* — which is worse. A false "bounded,
no impact" closes an investigation; a false alarm merely wastes time. **Nobody re-checks good news.**

The valid half of the rule survives: don't report a true mechanism with an unmeasured blast radius,
because that reads as a crisis. Just don't manufacture the bound out of guesses either.
