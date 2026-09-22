---
name: technique_ab_suite_delta_four_dispositions
description: "A/B suite delta protocol for a change that adds/widens a diagnostic: same-binary baseline vs treatment, then FOUR dispositions per delta test (real finding / predicate too broad / not reproducible individually / pre-existing) — re-run each individually on BOTH binaries before classifying. Preserve the baseline binary+lib before rebuilding."
metadata:
  node_type: memory
  type: technique
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# A/B suite delta with four dispositions

**Built 2026-08-06 on slang#12284** (a new default-on warning). Reusable for any
change that adds or widens a diagnostic, where "how many tests newly fail?" is the
load-bearing question.

## Why a raw count is not enough

`slang-test` compares against `.expected` files, so a new warning flips an existing
test to **FAIL** without any count looking alarming. The deliverable is a **pass/fail
delta**, never an absolute failure count. And a delta alone is still not enough: the
two arms run **sequentially under different machine load**, and the suite has flakes
and timeouts. A spurious "newly failing" test gets classified as "the diagnostic is
correct there", the `.expected` is updated, and **the corpus is silently corrupted in
a way invisible afterward — worse than a red CI run, because it looks like a fix.**

## Protocol

1. Build the **fix-absent** binary, run the full suite = **BASELINE**. (The revert
   drill already produces this binary — run the baseline arm before restoring the fix.)
2. Restore the fix, rebuild, run the **identical** command = **TREATMENT** (same
   machine, submodules, corpus).
3. **Instrument self-check:** the new diagnostic's count in BASELINE must be **0 by
   construction** (the code isn't in that binary). If it isn't 0, report the instrument
   as broken; do not reason past it.
4. For **every** delta test, **re-run it individually on BOTH binaries** before
   classifying. This is the step most likely to be skipped and the one that protects
   the `.expected` files.

⛔ **PRESERVE THE BASELINE BINARY *AND* `lib` BEFORE REBUILDING** — step 4 needs it,
step 2 destroys it (rebuilding replaces outputs in place). Between steps 1 and 2:
`cp -a build/Debug/bin build/Debug/bin.baseline` **and** the `lib` dir. `slangc` is a
thin driver; the compiler lives in the shared library, so preserving only `bin` yields
a "baseline" that dynamically loads the NEW library — a control silently containing
the fix, reporting 0 for the wrong reason. Run it `LD_LIBRARY_PATH=<preserved lib>
<preserved bin>/slangc`. **Verify the preserved control on TWO axes** (a copy that
fails to run also reports 0): (a) emits **0** of the new diagnostic ⇒ fix-absent;
(b) still **compiles something** ⇒ not a broken/truncated copy.

Finding this class of gap is a general method — audit a protocol by asking **"what
does each step CONSUME?"**: [[technique_audit_a_protocol_by_what_each_step_consumes]].

## The four dispositions

| # | Disposition | Evidence | Action |
|---|---|---|---|
| 1 | **Diagnostic correct there** | reproducible individually on treatment, passes on baseline | Update **that** expectation — named, per file, with the reason |
| 2 | **Predicate too broad** | fires where it shouldn't | **Fix the predicate — never the expectation** |
| 3 | **Not reproducible individually** | **passes** on individual re-run of the *same treatment binary* | Exclude — **state the exclusion with the test name** |
| 4 | **Pre-existing failure** | fails individually on **both** binaries | Not yours; **remove from the delta entirely** |

- Timeouts default to 3 pending an individual re-run.
- ⛔ **No silent bulk re-baseline.** Every `.expected`/annotation change is named with
  its category.

**Name dispositions by OBSERVED OUTCOME, never by SUSPECTED CAUSE.** The original
table read "flake / load artifact" for #3 — a defect: naming a bucket after a *cause*
invites putting anything with that cause in it, and #3 is the only disposition that
*removes* an item from the delta. A GPU test failing repeatedly under sustained load
is failing **deterministically in that environment** (a *contention-induced failure*,
not a "flake" — "flake" asserts a nondeterminism you haven't measured); it belongs in
4 (fails on both arms), not swallowed by a cause-named 3. Category 3 is defined solely
by the re-run's outcome — it passes individually on the same treatment binary — nothing
about why.

## The two rules that make it honest

- **A test you excluded is a claim you are making.** Categories 3 and 4 are not
  disposal bins; each exclusion needs its own named evidence. Dropping a test silently
  is indistinguishable from hiding a real regression.
- **Rest "unrelated to my change" on evidence that cannot move** (the RPC-failure
  signature; presence in **both** arms), and report the recovered/not-recovered split
  as *data*. Then a rising confirmed-failure count updates a figure instead of
  falsifying your claim.

## Mechanizing it — validate the instrument, not just the change

Bucket every test mechanically (NEWLY FAILING / NEWLY PASSING / FAILING IN BOTH /
ONLY-IN-BASELINE / ONLY-IN-TREATMENT), and **validate the delta parser against the
REAL log before trusting it** — a regex that matches nothing produces the pristine
`+0` you were hoping for. The full log-parser validation discipline (enumerate the
real status tokens, the cross-total assertion, the self-compare + mutation control
pair, and the completeness axes that keep a set-difference honest) is its own
technique: [[technique_validate_a_log_parser_on_the_real_log]]. Its figures obey
[[feedback_the_remedy_for_an_untrusted_number_is_re_measurement_not_arithmetic]] —
compute totals in code, never type one next to the list it counts.

⚠️ **Runtime:** a suite arm is ~45+ min under load (repo docs' "10–30 min" undersells
it) — don't read a slow arm as a hung one.

See [[project_12284_cross_module_overload_silent_break_warning]] for the instance.
