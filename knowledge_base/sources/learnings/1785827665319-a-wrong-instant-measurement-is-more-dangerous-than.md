# A wrong-instant measurement is more dangerous than a wrong argument — a dump launders a reasoning error as data

# The probe that cannot fail is the one that looks most convincing

**Observed 2026-08-04, shader-slang/slang#11917.** Closing episode of a chain in which four
successive mechanisms for one conclusion all died.

## The defect

Question: at the governing scan, can a consumer instruction be present while the instruction that
*implies* it is absent? (If yes, a conservative implication misses it and a gate is unsafe.)

The probe: `-dump-ir-before lowerTagInsts`. It returned exactly the sought shape —
`tagops > 0, tagged-union = 0` — across three files.

The pipeline:

```
scan#2                :1519   ← the instant the claim is ABOUT
unpinWitnessTables    :1576
lowerTaggedUnionTypes :1607   ← the CONSUMER: removes the implier
lowerTagInsts         :1617   ← where the probe was taken
```

The probe read state **after** the implier's consumer had run. It was therefore
**structurally incapable of returning any other answer** — `tagged-union = 0` was guaranteed by
where the dump was taken, not by anything about the module. Re-probed in-window at `:1576`:
tagged unions present in **every** shape; no isolating shape in ~80 files swept.

## Why this is worse than a bad argument

A bad argument invites scrutiny — it reads as reasoning, and reasoning gets challenged. **A dump
reads as data**, and data ends debate. The measurement had:

- a real command,
- real output,
- exact numbers,
- and it *agreed with the hypothesis*.

Nothing about it looked like an inference, so nothing about it invited the question that mattered:
*at what instant was this taken?* It was one step from being published as an "isolating regression
test," which would have laundered a false mechanism into apparently-empirical fact.

## Rules

- **A claim about state at instant T must be measured AT instant T.** Before trusting any dump,
  locate the probe point in the pipeline relative to every pass that produces or consumes the thing
  you are counting. A probe downstream of the consumer cannot refute an implication.
- **Ask of any confirming measurement: "could this probe have returned a different answer?"** If
  the answer is no, it has no information content regardless of how clean it looks. This is the
  positive-control question aimed at *placement* rather than at the instrument.
- **A byte-identical revert-drill proves a gate does not BREAK things; it can never prove the gate
  WORKS.** A gate on a flag that is never set skips nothing, so emission is trivially identical and
  the drill is green. **Gate tests need a control that proves the gate FIRED.**
  ⚠️**WORKED EXAMPLE — PROVENANCE CORRECTED TWICE, 2026-08-04 (author). Final, verified form:** the
  `AssumeAddress` dead flag was **real, but as a transient in-development state of the batch-2 draft
  (PR #12336), caught by its author before publication — it never reached `master` or any remote ref.**
  Both corrections were needed because I first wrote it as a *shipped* defect (wrong), then
  over-corrected toward *never happened* (also wrong). Positive control at `master` confirms the
  public-absence half: `RequiredLoweringPassSet` (`slang-code-gen.h:52-88`) has 34 flags, all with
  setters, no `assumeAddress`. PR #12336's own body supplies the other half: *"An **earlier draft** of
  this change added an `assumeAddress` flag… and never set it."*
  ⭐**"It happened" and "it shipped" are different claims — and over-correcting a false "shipped" into
  a false "never" is the same error with the sign flipped.** A retraction is itself a claim owing
  evidence.
  The rule above stands independently, with in-tree grounding: `tests/hlsl/lower-lvalue-cast-skip.slang`
  states in its own comment that skip-vs-run *"is a compile-time-only property that is not observable
  in emitted output."* Correction is inline, not appended, because this example was load-bearing
  exactly where it was wrong. **A prospective "gate on X when it lands" needs a mechanism; "X shipped"
  needs an artifact.**

## The generalization this closes

The chain kept regenerating one error — *producer-vs-governing-scan* — in successively subtler
forms: first as reasoning ("not synthesized by that pass"), then as an invalid inference
("co-emitted, therefore covered"), then as a scope error ("all paths, from one of 42 sites"), and
finally **as a measurement**. The same misconception survives translation between media. When a
family of errors keeps recurring, check whether your *instruments* encode it, not just your
arguments.

## Coda: two more instrument errors in the same episode

- **`grep -c` counts matching LINES, not occurrences.** A "only 16 sites" objection — used to argue
  someone else's totality claim rested on too few sites — was itself undercounted; the real figure
  was ~42 lines / ~43 occurrences. *An objection about undercounting, undercounted.* Same defect
  class as `search/code`'s `total_count` counting matches rather than files.
- **An unqualified hex string that fails `git cat-file -t <hash>` as a commit is usually a BLOB or
  TREE.** A "different SHA, so possible line drift" caveat dissolved once the hash was identified
  as the **blob hash of the file** at the same HEAD (`git rev-parse <commit>:<path>` reproduced it).
  Byte-identical content, invented divergence. **Check an object's TYPE before treating a hash
  mismatch as a revision mismatch.**
