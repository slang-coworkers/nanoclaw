---
name: technique_validate_a_log_parser_on_the_real_log
description: Before trusting any log parser, enumerate the status tokens actually present in the REAL log, assert sum(bucketed)==total lines matched, and validate with a PAIR of controls (self-compare + one-line mutation). A self-authored fixture validates the code against your model of the format, not the format. A difference is meaningless unless both operands are complete.
metadata:
  node_type: memory
  type: technique
---

# Validate a log parser on the REAL log, not your model of it

A parser that matches nothing produces `+0 newly failing` — **exactly the result you
were hoping for**. Success and broken-instrument are indistinguishable. So a `+0` is
only meaningful once the instrument has demonstrated it can produce a non-zero.

## A self-authored fixture validates the CODE, not the MODEL

A synthetic fixture is built from the shapes you already believe exist; it cannot
reveal a status form you don't know about. A mutation that flips `passed test:` →
`failed test:` only exercises a form the parser already handles. **Measured on
slang#12284:** both controls passed while the parser scored every failure as absent —
`slang-test` emits failures as `failed(pending retry) '<name>'` with **no `test:`
token**, which the parser never matched, so both arms read "0 failed" and shipped a
pristine `+0`.

⇒ **Only the real log exposes a missing status form.** Before trusting a parser,
enumerate the distinct status tokens actually present and reconcile them against the
parser's cases:
`grep -oE '[a-z()A-Z ]+ ?test:|failed\([^)]*\)' log | sort | uniq -c`
A form you never enumerated is a form you silently drop.

## The cross-total assertion — the one control that isn't self-authored

Assert **`sum(bucketed) == total lines matched`** by construction. It derives its
expectation from the ARTIFACT, not from your model of it, so it catches forms you
never imagined. On the same run it immediately exposed a *second*, independent
undercount: `6403` status lines vs `6399` parsed names, because performance tests
append a timing *after* the closing quote (`'…' 60.2us`) and the regex ended `'\s*$`.
Two independent silent-undercount defects in one instrument, each found by a different
check, neither findable by the other. **Bake it in:** print the raw status-form
inventory per arm, flag any UNRECOGNISED token, and hard-exit if a log has failure
lines but parses to zero failures.

## Two controls, failing in opposite directions — you need BOTH

| control | how | proves |
|---|---|---|
| **self-compare** | diff baseline against **itself** over the real log | it doesn't **manufacture** findings — expect `+0`, all buckets empty |
| **mutation** | flip exactly **one** real `passed test:` line to `failed`, re-run | it doesn't **miss** findings — expect `+1`, naming that precise test |

Self-compare alone can't catch a match-nothing parser (it also reports `+0`). Also
assert the new diagnostic actually fires in the TREATMENT binary, or an A/B can
compare two identical binaries and report a clean `+0`.

## A difference is meaningless unless both operands are COMPLETE

A set-difference over partial logs fabricates findings, and **the artifact flatters
whichever arm is short**: a short *baseline* → spurious NEWLY FAILING (you
investigate, self-correcting); a short *treatment* → spurious NEWLY PASSING (flatters
the change — you accept it). Build the refusal for the flattering case first.
Completeness has **two independent axes**, both required — a volume guard cannot see
the second:

1. **Volume** — comparable verdict counts across arms.
2. **Resolution** — every `failed(pending retry)` mark confirmed or cleared. A mark is
   not a verdict; it is an unresolved state. `if marks > 0 AND confirmed == 0 AND
   unresolved > 0 → REFUSE`.

⭐ **A guard written against one instance covers that instance, not the class** — after
fixing a guard, ask what *else* could produce the identical wrong output. And
**range-check every derived figure independently**: a `-25` "newly passing" from a
warning-only change is prima facie impossible; absurdity is a stronger detector than
agreement, because a plausible wrong number survives review.

## Shell traps that corrupt the delta

- **Never iterate test names in a shell `for` loop** — they contain spaces and
  parens, so `for t in $(…)` word-splits one real finding into several fabricated
  ones. Do the comparison in Python or `while IFS= read -r` with a line-anchored regex.
- Both `failed test:` and `FAILED test:` spellings appear; a third status
  `ignored test:` exists; duplicate names occur on retry (**take last-line-wins**, or a
  recovered flake counts as a failure).
- A loose `grep` in the **baseline** can match the new test's own annotation text
  quoted in its failure report — when the artifact under test contains the pattern you
  search for, a loose grep measures your own fixture. Use the precise form
  (`grep -cE 'warning\[E38208\]'`).
- Measure the true exit unpiped or with `set -o pipefail` — a pipe launders a failure
  into `tail`'s success.

Family: [[feedback_a_control_built_from_the_matchers_own_assumption_is_blind]],
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]],
[[feedback_the_remedy_for_an_untrusted_number_is_re_measurement_not_arithmetic]].
Applied in [[technique_ab_suite_delta_four_dispositions]].
