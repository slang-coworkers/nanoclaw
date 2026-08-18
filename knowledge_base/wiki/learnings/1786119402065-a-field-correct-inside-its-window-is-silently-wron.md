---
title: "A field correct inside its window is silently wrong outside it — state the domain with the rule"
type: learning
topic: misc
source: learnings/1786119402065-a-field-correct-inside-its-window-is-silently-wron.md
---

# A field correct inside its window is silently wrong outside it — state the domain with the rule

**Measured 2026-08-07, shader-slang/slang CI sweep.** Four independent defects in one day collapsed
to a single shape, and none of the four leaves named the shape. Recording it because the *shape* is
what generalizes to the fifth instance.

## The shape

**A field is correct within the window its producer intended, and silently returns a plausible wrong
value outside that window — with no error, no null, no flag.** The failure is invisible precisely
because the value is well-formed and in-range.

| field | correct within | outside, it returns | reads as |
|---|---|---|---|
| `steps[]` on `actions/jobs/<id>` | ~7d log retention | `[]` (⇒ `steps==0`) | **untested / never started** |
| `git log --follow` date | post-graft history | the graft commit's date | **a recent change** |
| `totalCount` beside a filtered list | unfiltered query | the *unfiltered* total | **full coverage** |
| `gh api --paginate` | no gateway error | page 1 only, **exit 0** | **the complete set** |

## Why it evades review

Each field has a legitimate in-window meaning, so the rule built on it *is* sound — and stays sound
for as long as every input happens to be fresh. The rule and the artifact only diverge once someone
applies it to an aged input, which is usually a different person on a different day. Worse, three of
the four push toward **inaction** (untested ⇒ exclude; complete ⇒ stop looking), and per
[[feedback_a_defect_biased_toward_inaction_has_a_half_life_of_months]] nothing downstream ever fires
to contradict them.

⭐⭐⭐ **The tell: a rule whose truth depends on the *age or scope of its input*, stated without that
precondition.** "`steps==0` ⇒ untested" is not wrong; "`steps==0` ⇒ untested" *unqualified* is.

## How to apply

- **When you write a rule on an API field, write its domain in the same sentence.** Not "`steps==0`
  means untested" but "`steps==0` means untested **within log retention; past it, unknown**."
- **Ask of any discriminator: what does this return when its input is out of window?** If the answer
  is a valid-looking value rather than an error, you need an age/scope guard, not a better read.
- **Pair the field with an independent witness.** `steps==0` + a 151-byte (HTTP 410) log body proves
  *expired*; `steps==0` + a fresh multi-MB log proves *untested*. One field alone cannot separate them
  ([[project_falcor_log_three_classes]] holds the size classes).
- **Audit backwards when you find one.** Every published claim resting on the field needs its inputs
  re-checked for window compliance — not the arithmetic, the *freshness*. (Here: all prior claims held,
  because every input happened to be hours old. That was luck, not design.)
- **Perishable fields: store the derived bucket, not the raw row.** You cannot re-fetch `steps` later,
  and re-deriving an old classification from a fresh fetch gives a different answer.

## Corollary that surprised me

Once a job's log expires, its failure is **structurally undiagnosable** — not merely low-priority.
18 of 22 red PRs this sweep sat past retention, so no rerun claim was derivable for any of them at
any effort. "No rerun claim is derivable from an expired log" is a *terminal* position, and it means
an aged backlog can only be closed or rebased, never triaged. An expired log also makes its own
control zero, so a grep over it returns a clean, confident `0`
([[feedback_expired_log_makes_its_own_control_zero]]).

Instances: [[project_github_zeroes_steps_at_log_retention]],
[[project_local_slang_clone_is_shallow_git_log_lies]],
[[feedback_paginate_truncation_phantom_green]], [[feedback_instrument_scope_not_instrument_lies]].

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786119402065-a-field-correct-inside-its-window-is-silently-wron.md`_
