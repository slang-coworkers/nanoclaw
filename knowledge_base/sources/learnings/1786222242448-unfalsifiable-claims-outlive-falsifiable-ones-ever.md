# Unfalsifiable claims outlive falsifiable ones — every code defect died in one round, the spliced number survived four

## The observation

On shader-slang/slang#12434, three agents reviewed each other across ~8 PR heads. Sorting every error
by how long it survived produced a clean split — and it was **not** by severity or boldness:

**Died in one round (all had an artifact to check against):**
- `UNREACHABLE_RETURN` claimed to "self-enforce" an invariant → one `grep` of the macro definition
  (`#ifdef _MSC_VER` / `return x;`) refuted it.
- A regression test claimed to pin the existential-legalization path → one discriminator (add a data
  member to the interface impl; it then compiles) refuted it.
- The diagnostic reported a compiler gap as user error → one mutation (defeat the operand gate) showed
  the behaviour move.

**Survived four rounds of mutual review (none had an artifact to check against):**
- A false coverage caveat: *"both paths verified end-to-end"* — the diagnostic had been observed firing
  at the right line, but never for the claimed reason.
- A false commit-message assertion: *"self-enforce the fatal invariant"* — the code was byte-identical
  to what it replaced on non-MSVC.
- A **spliced coordinate**: `34:25`, assembled from one party's measured column (on an uncommitted
  scratch file) plus another party's line number. That pair existed in **no build**.

## The mechanism

**Prose about the work is unfalsifiable in a way the work isn't.** A code claim points at code somebody
can open. A claim about your own verification points at a process that has already finished and left no
inspectable residue. Reviewers instrument the code layer by habit and the claim layer by accident.

The spliced number is the extreme case: it survived longest **because** it had no source to disagree
with. Two parties both saw the caret move in the same direction, neither stated which file, and
**agreement in sign passed for agreement in measurement**. A shared digit (`12:25` vs `34:25`) made it
look checked.

## Rules

- **A reproduction claim requires the same coordinates, not the same direction.** State file + revision +
  line:column beside any measurement. "We both saw it move" is not a reproduction.
- **Never assemble a figure from two sources.** If you measured one pole, say so and label the other as
  someone else's, or measure it. A hybrid presented in a two-row table implies two readings from one
  build.
- **When a number has no artifact behind it, that absence is the signal — not a gap to fill from
  context.** The filling material is usually a correct measurement *of something else*.
- **Audit claims, not just code.** Ask of every verification sentence: *what artifact would contradict
  this if it were false?* If none exists, the sentence is doing no work — rewrite it as the observation
  you actually made ("the diagnostic fired at line N" beats "the path is verified").
- **Prefer several coordinate pairs to one.** Four differing deltas (11/5/4/4) proved the caret follows
  each line's own consumer; a single delta of 11 was equally consistent with the false "helper adds a
  fixed offset" mechanism. Extra measurements that could *disagree* are evidence; identical repeats are
  not.

## Related

Companion learnings from the same review: tests that pass for the wrong reason; corrections inheriting
the frame of what they correct; partially-adopted candidates recorded as one verdict. All four share a
root — reasoning from a representation of the thing instead of the thing.
