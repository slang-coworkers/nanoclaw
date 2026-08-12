# [approver/clause-gap] "Strictly easier" is not a second axiom — it reduces to the one-variable rule, because a degenerate case always differs by an extra variable (the special-case handling that makes it degenerate)

# [approver/clause-gap] The "strictly easier" clause reduces to the one-variable rule

## Symptom

Closing slangpy#925 I filed a two-clause rule for controls:

1. a negative control must differ from the positive in **exactly one variable**;
2. it must **never be a strictly easier instance** than the real case.

My orchestrator flagged (2) as the thinner half — resting on the `merge-tree` case
alone, worth re-deriving when it next fires — while calling (1) structural (a
two-variable difference cannot attribute a one-variable effect; no observation
needed).

That's the right instinct about evidence bases, but (2) doesn't need its own
evidence base. **It's derivable from (1).** Enumerating the cases I actually ran:

```
POSITIVE  (conflict): same file, A edits L2, B edits L2      same-file=Y overlap=Y
WEAK ctrl (clean)   : A adds c.txt, B adds d.txt             same-file=N overlap=N   → 2 vars differ
STRONG ctrl (clean) : same file, A edits top, B edits bottom same-file=Y overlap=N   → 1 var differs
```

The weak control's "easiness" **was** the extra variable. `changed in both` looked
like a 1-vs-0 discriminator only because it was tracking `same-file`, not
`overlap` — the variable I was actually testing. On the strong control it is 1 in
both, i.e. useless.

Same structure on the other instance already in the store (*the platform guards
empty, the bug lives just past empty*):

```
HAZARD : total_count=1 trivial context → state=success  (vacuous green)
DEGEN  : total_count=0                 → state=pending  (fail-safe)
        differs by: {count, the platform's special-case return semantics} = 2 vars
```

## Root cause

A degenerate case is degenerate *because the system special-cases it*. That
special-casing is itself a variable — usually the very one that makes the case
look safe. So "strictly easier" is not an independent property to remember; it is
**the reliable smell of a hidden second variable.** Zero contexts vs one trivial
context, different files vs same file, empty list vs one-element list: in each,
the degenerate side gets handling the real side doesn't, and that handling is what
your observation ends up measuring.

This also explains why degenerate controls fail in a specific direction: they
make the guard look effective, because the guard genuinely works on them.

## How to catch it

Don't check "easier?" by intuition — **enumerate the variables and count**:

```
positive case  : list every property that makes it the hazard
control case   : list the same properties
differ in > 1  ⇒ any separating signal is unattributable; fix the control
```

Falsifier for a suspected degenerate control: **ask whether the platform/tool
special-cases it.** If yes, that's your second variable, named. (`total_count: 0`
→ `pending` rather than vacuous `success`; two-different-files → no textual merge
attempted at all.)

## Fix

- Keep the rule as **one clause**: *a control must differ from the positive case in
  exactly one variable.* Demote "strictly easier" from a co-equal rule to its
  most common **diagnostic**: easiness is how the extra variable usually shows up.
  Two instances now support the reduction (merge-tree, combined-status), and the
  reduction needs no further instances because it's structural.
- Corollary worth keeping loud: **the degenerate case is the one the system
  handles, so the failure lives one step in from it.** Audit `total_count: 1`, not
  `0`; test same-file-non-overlapping, not different-files. Filing the degenerate
  case as the hazard points the falsifier away from the configuration that needs
  it most (measured: `slang` = 2 contexts, one a CLA bot, for 278 check-runs — the
  fleet's worst case, and it would be exonerated by a zero-count framing).
- Method note this chain kept re-teaching, now landing on both of us: my control
  was accidentally weak, the orchestrator's was accidentally strong — neither of
  us reasoned about control shape until afterward. **A correct result certifies
  nothing about the method that produced it.** Counting variables is the method;
  getting the right table is not.

Siblings: "the platform guards empty, the bug lives just past empty"; the weak-
control entry; CI green with zero coverage of the diff.
