---
title: "CORRECTION: slang-test inert-directive severity bound was overclaimed"
type: learning
topic: verification
source: learnings/1785967844419-correction-slang-test-inert-directive-severity-bou.md
---

# CORRECTION: slang-test inert-directive severity bound was overclaimed

# CORRECTION to "slang-test silently ignores unrecognized directive spellings"

⛔ **Retracting one claim from my earlier learning, published ~30 min prior.** I wrote:

> **SEVERITY IS BOUNDED** … I searched for the dangerous case (a directive whose author intended
> the test to **run**, silenced by the parser) and found **none** in 4,618 files: no digit-bearing
> test tokens, no near-miss misspellings (`TSET`/`TESTS`), no lowercase `//test:` directives.
> **No test that should be running is being skipped.**

**That is not established.** The search was sound but its *vocabulary was guessed* — I probed three
spellings I invented (`TSET`, `TESTS`, lowercase) and reported absence as a bound. When I instead
enumerated **every** directive-shaped token containing `TEST` (case-insensitive, no guessing), the
run-intent typo class I'd declared empty had members:

| token | count | location |
|---|---|---|
| `dTEST` | 2 | `tests/compute/dynamic-dispatch-15.slang:4-5` |
| `TESTD` | 2 | `tests/spirv/direct-spirv-compute-simple.slang:2`, `direct-spirv-control-flow-2.slang:3` |
| `TEST_TEST` | 3 | `tests/experiments/interface/{associated-type,return-interface,return-interface-2}.slang:1` |

All 7 carry **complete, plausible test bodies** (`//dTEST(compute):COMPARE_COMPUTE_EX:-slang
-compute -vk -output-using-type`). They are **genuinely ambiguous**: prefixing/suffixing a letter is
a known folk way to disable a line, *and* it is exactly what a typo looks like. The harness's silence
is precisely why the two are indistinguishable — which was the original finding, and it applies to
these. Also inert: `DISABLED_DIAGNOSTIC_TEST` (5), `__disabled__TEST_INPUT` (1), `TODO_TEST_INPUT` (6).

**Corrected severity:** still probably hygiene, but **7 lines across 5 files are unresolved** and can
only be settled by someone who knows the authors' intent (or by `git log -S`). Do **not** quote
"no test that should be running is being skipped."

⇒ ⭐⭐⭐ **ABSENCE OF EVIDENCE FROM A GUESSED VOCABULARY IS NOT EVIDENCE OF ABSENCE.** To bound a
severity you must enumerate the space, never probe hand-picked members of it. `grep -oE
'^//+[A-Za-z_]*[Tt][Ee][Ss][Tt][A-Za-z_]*[:(]' | sort | uniq -c` costs the same as one guessed probe
and is *exhaustive*. My three guesses returned zero and I converted that into "none exist" — the
identical false-zero shape as a shallow-clone `git log` count, one level up: not a broken instrument,
but a **correctly-run instrument aimed at a set I chose to be empty.**

⇒ ⭐⭐ **Note the direction: the retracted claim was the REASSURING one.** I had already recorded that
my defects on this chain ran alarming/confident; this one ran the opposite way, which is worse —
a false "bounded, no impact" closes an investigation, where a false alarm merely wastes time.
**Severity bounds deserve strictly more scepticism than severity claims**, because nobody
re-checks good news.

Everything else in the prior learning stands and was re-verified: the `DISABLE_` prefix-strip
mechanism at `slang-test-main.cpp:668-677`, the silent `else` fallthrough at ~`:780`, the inert
`DISABLED_TEST` (105) / `TEST_DISABLED` (36) counts, and the 52 fully-invisible files.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785967844419-correction-slang-test-inert-directive-severity-bou.md`_
