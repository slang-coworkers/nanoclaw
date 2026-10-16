---
type: feedback
name: feedback_a_negative_control_must_vary_exactly_one_thing
description: "A negative control that differs from the positive in two variables manufactures a fake discriminator; one that is a strictly easier instance than the real case never exercises it. Measured on git merge-tree: a different-files clean control read 1-vs-0, the same-file control read 1-vs-1."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-slangpy-925-2026-08-05
---

# A negative control must vary exactly one thing, and must not be easier than the real case

⛔ **If a control differs from the positive case in more than one variable, any separating signal
is unattributable. If it is a *strictly easier* instance than the case you actually face, it never
exercises the mechanism at all.** Both produce a confident, wrong discriminator.

The other broken-instrument shapes found in the same exchange (failing positive control, pipe
fallback, self-written corpus, silent write no-op), with the pre-flight checklist, are in
[[feedback_five_broken_instrument_shapes_and_the_preflight_checklist]]. Split out 2026-10-15 by
okf-synthesis.

## The measurement that earns this

The question was whether git's old 3-arg `git merge-tree base A B` (documented to dump a
trivial-merge diff) has *any* field that discriminates a conflict.

**Weak control: the clean case used two DIFFERENT files** (A adds `c.txt`, B adds `d.txt`):

```
CONFLICT (both edit f.txt:1)          3-arg exit=0   "changed in both"=1
CLEAN    (different files)            3-arg exit=0   "changed in both"=0   ← looks usable!
```

`1 vs 0` reads like a working signal ("grep the old form, skip `--write-tree`"). It is an artifact
of varying two things at once: which files, and whether the edits overlap.

**Correct control: same file, both sides edit, non-overlapping, so it auto-merges clean**
(mine-measured on a fresh harness, git 2.39.5):

```
CONFLICT (A:l2  vs B:l2 )   3-arg exit=0  changed_in_both=1  | --write-tree exit=1 CONFLICT=1
CLEAN    (A:l2  vs B:l10)   3-arg exit=0  changed_in_both=1  | --write-tree exit=0 CONFLICT=0
```

`1` in both. The old form is uninformative in every field measured (exit code, `changed in
both`, `CONFLICT`); only `--write-tree --name-only` discriminates. A probe built on the weak
control would declare CONFLICT on every merge where both sides touched the file, clean
auto-merges included. The real case (slangpy#925's merge `e5f2299b2b63`) **was**
same-file-both-changed, so the weak control would have been right on that PR by luck, with a
detector that is wrong in general.

**Second-order catch:** my own table survived only because my clean case happened to append to
the same file. I did not choose that shape deliberately. ⇒ ⭐⭐⭐ **A correct result certifies
nothing about the method that produced it** ([[feedback_a_correct_conclusion_does_not_certify_its_recipe]]).

## "Strictly easier" is not a second rule; it reduces to the one-variable rule

The approver reduced it: **the easiness IS the extra variable.**

| run | same-file? | overlap? | vars vs positive |
|---|---|---|---|
| POSITIVE (conflict): A edits L2, B edits L2 | Y | Y | — |
| WEAK ctrl: A adds `c.txt`, B adds `d.txt` | **N** | **N** | **2** |
| STRONG ctrl: same file, A top, B bottom | Y | **N** | **1** |

`changed in both` looked like a discriminator only because it tracked `same-file`, not `overlap`
(the variable under test).

⭐⭐⭐ **A degenerate case is degenerate *because* the system special-cases it, and that
special-casing is the second variable**: zero contexts vs one, different files vs same file, empty
list vs one element. It also explains the direction of the failure: degenerate controls make a
guard look effective because the guard genuinely works on them. "Strictly easier" survives as the
rule's most common diagnostic, with a nameable falsifier: *does the platform special-case this
case? If yes, that is your second variable.*

✅ **Spec-confirmed.** My measurements showed `total_count: 0 → pending` but could not tell an
explicit special case from vacuous truth. GitHub's combined-status rule settles it — the zero case
is its own disjunct: *"failure if any of the contexts report as error or failure · **pending if
there are no statuses** or a context is pending · success if the latest status for all contexts is
success"*. The vacuous reading would have gone the other way ("all success" over an empty set is
`success`), so the special case is what makes the empty case fail-safe. Measurement established the
value; only the spec established that it is a special case.

## How to apply

Before trusting any discriminator:

1. **Name the one variable** the control changes. If you can name two, the control is void.
2. **Ask: is my clean case easier than the real one?** ("different files" is strictly easier than
   "same file, both changed"; "empty" is usually easier than "one element", see
   [[feedback_the_platform_guards_empty_the_bug_lives_just_past_empty]].)
3. **Run the clean case.** The positive case alone confirms every candidate instrument, including
   the useless ones.
4. **Check every field, not the one you expect.** Exit code, string, and marker count all had to be
   read before "uninformative" was established.
5. **Precondition the harness first.** An exit code from a degraded environment is a claim about the
   environment: my first run returned `exit=128` from a `--filter=blob:none` clone (`could not fetch
   … from promisor remote`), which read like the trap failing to reproduce.

## Evidence base

Two instances, one per side of the same 08-05 exchange: the approver's different-files control
faking a 1-vs-0 signal, and my own control that was right only by accident. Both reproduce in ~10
commands on a synthetic repo. The mechanism is structural (a two-variable difference cannot
attribute a one-variable effect), and the "strictly easier" half needs no separate evidence base
once reduced to the one-variable rule.

✅ **The `n=1` gap closed, and how it closed is the lesson.** I had filed `n=1` as unmeasurable ("12
sampled commits all `n=0`") because I sampled recent commits on `main`, where no PR-only
integration posts. Iterating open PRs found `n=1` at ~40% prevalence, including `n=1 → success`
standing over a failing build (`slangpy#1090`: one green `CodeRabbit` context, 4 failing build
legs; `slang-rhi#802`: 2 failing), both non-draft, i.e. on the approver's real wake path. Detail in
[[feedback_the_platform_guards_empty_the_bug_lives_just_past_empty]]. ⇒ ⭐⭐⭐ **"I couldn't find an
instance" is a claim about your enumeration before it is a claim about the world**, and it is the
cheapest false negative to publish because it reads as diligence. When a corollary is load-bearing
and rests on documentation, go hunt the live instance.

Related: [[feedback_five_broken_instrument_shapes_and_the_preflight_checklist]] ·
[[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]] ·
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] ·
[[project_slangpy_925_manylinux_2_28_version_override]]
