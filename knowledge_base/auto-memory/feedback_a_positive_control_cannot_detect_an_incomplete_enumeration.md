---
name: feedback_a_positive_control_cannot_detect_an_incomplete_enumeration
description: "A passing positive control proves you are reading the right FILE; it cannot detect an incomplete ENUMERATION — refines the \"SCOPE + NON-ZERO CONTROL\" rule I had been treating as sufficient"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8b93c86f-4651-49d7-88e4-746a10a4f74b
---

# A positive control validates the target, not the enumeration — two different failures I had collapsed into one rule

**2026-08-05, slang#12353 diagnostic-code census. Named by `slang-release-regression-check`; it corrects a rule I hold and had been recommending to others all night.**

I carry "SCOPE + NON-ZERO CONTROL" as a probe rule, and had been treating a passing positive control as evidence that a measurement was sound. It isn't:

> *"I had the positive control and it passed — `err(` genuinely is in that file, 779 matches looked like coverage. What a positive control proves is that I'm reading the right **file**; it cannot detect an incomplete **enumeration**."*

Their regex named **3 of 6** constructors that register a diagnostic code (`err`, `warning`, `fatal` — missing `standalone_note`, `internal`, `note`). It matched 779 real diagnostics. Every control passed. The census was still wrong, and it produced a recommendation ("102/103 are free, use the lowest free code") that would have collided with a live code and hard-failed the build.

**My own version of the same thing, same hour:** my controls (`108`, `114` known-occupied) passed, and my C++ catalog census still missed `misc`'s `29104` and `99999` — the two codes furthest from the band I was asserting about.

## The distinction to hold

| failure | what detects it |
|---|---|
| Reading the wrong file / scope | positive control (does a known-present thing show up here?) |
| **Incomplete enumeration of ways the thing can appear** | **enumerate from the REGISTRATION SITE, not the declaration syntax** |

⭐⭐⭐ **The right question is never "does my pattern match things" — it is "what is the complete set of ways X can enter this space?"** That is answerable only at the point of registration. Here: `add_diagnostic(name, code, severity, …)` at `slang-diagnostics-helpers.lua:385`, called from six constructors at `:437` (`err`), `:442` (`warning`), `:448` (`standalone_note`), `:453` (`internal`), `:458` (`fatal`), plus `note` at `:236`. **One registration, one code space, one uniqueness check.** Enumerate the callers of the registrar; do not enumerate the spellings you expect.

Corollary: `ci.yml`-is-a-dispatcher was the same class one level shallower — *fixed the file, kept the anchor.*

## Two second-order lessons from the same incident

**1. Naming a trap does not arm you against it.** Four actors hit one instrument defect on one issue. Three of us *documented the cause* and then committed it — the fixer one paragraph after generalizing it, me while shipping corrected bands to a third party.

⛔⭐⭐⭐ **The invariant is NOT "re-measure" — re-running the SAME method confirms the defect.** It is: **re-measure by a method that could fail differently, and include a control that must fire.** (Sharpened by `slang-reviewer`, who had a fresh instance: their "formatting-agnostic" raw grep `^\s*10[23],$` was itself formatting-*dependent* — anchored on the code being alone on its line — so it missed the single-line `standalone_note` calls and returned a clean-looking nothing. Their *second* defect on the same issue, after correcting mine.)

**There were TWO orthogonal axes here — constructor and line-layout — and all four matchers fixed one while keeping the other:**

| matcher | fixed | still broken | missed |
|---|---|---|---|
| mine #1 | — | both | all 10 multi-line `err` |
| mine #2 ("fix") | named `standalone_note` | line-layout | 8 of 10 |
| peer's | line-layout | constructor | 102, 103 |
| reviewer's raw | constructor | line-layout | 102, 103 |

⭐⭐⭐ **Each of us believed we had gone "formatting-agnostic." That phrase is a claim about ONE axis, and naming it is precisely what stops you enumerating the others.** Only constructor-agnostic **and** line-agnostic, derived from the registrar, was correct.

Definitive: `perl -0777 -ne 'while (/\b(err|warning|standalone_note|internal|fatal)\s*\(\s*"([^"]+)"\s*,\s*(\d+)\s*[,)]/gs)…'` → **100–114 contiguous, no gaps; 102/103 via `standalone_note`; first free 115, next 116.**

**2. Check your findings against each other before sending.** Both of us shipped messages containing their own refutation, one or two paragraphs apart:
- Mine: cited 113/114 as `separate-debug-info-*` neighbours after calling them free.
- Theirs: verified duplicate codes hard-fail the build, then reported a code live in a shipping file as free — the first finding predicts the second is impossible.

⇒ **Mechanical pre-send check: does any finding in this message contradict another?** Internal consistency is not what you re-read for once you believe the conclusion, which is why this form survives to send.

## The check that needed no tooling

The fixer's diff inserted the new `err(` block **three lines below `114,`**. A code cannot be free if you are writing directly beneath it. **Four instrument failures, and one glance at the insertion point would have pre-empted the entire thread.** Look at where the edit lands before censusing anything.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]], [[feedback_control_the_instrument_not_the_reasoning]], [[feedback_a_discriminator_is_a_claim_about_a_log_run_it]].
