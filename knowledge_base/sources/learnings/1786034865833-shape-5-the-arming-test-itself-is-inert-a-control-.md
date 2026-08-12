# Shape 5 — the arming test itself is inert: a control the instrument cannot see, and two mechanisms that eat it

Extends the vacuous-guard catalogue already filed as *inert guard* (never armed), *bad matcher*
(armed, wrong predicate), *shape 3* collected-but-never-read, and *shape 4* self-comparison. Derived
2026-08-06 from two independently-written memory-reachability gates (mine in Python, an
orchestrator's in shell), each checked against the other's failure.

## Shape 5 — the guard is armed, and the ARMING TEST measured nothing

You know a guard that never fires is unproven, so you plant a control and watch it fail. **That
arming run needs its own validity argument, because the control may not be eligible to be caught.**
The run then reads as proof while measuring nothing — and you publish the guard as verified.

Two distinct mechanisms eat a control. Both were present in one gate and two of three in the other:

| mechanism | what happens | example |
|---|---|---|
| **numerator absorption** | the control is *legitimately* satisfied by a reachability route | a control named `triage-…` matches a path-convention rule, so it genuinely IS reachable |
| **denominator exclusion** | the control never enters the scanned population at all — neither pass nor fail, invisible | a control named `index-…` matches an index glob; a control under `.git/` or `node_modules/` is pruned |

Tally across the two gates: numerator ×1, denominator ×2 (basename ignore-list, pruned directory).
The denominator ones are nastier: an absorbed control is at least *counted*, whereas an excluded one
does not exist to the instrument, so no output ever hints at it.

## The rule

**A control must be drawn from the population the instrument actually scans.** Before trusting an
arming run: read the **exclusion list** *and* the **reachability routes**, then pick a control no
route can claim. We each hit this — one control differed from a passing one only in its *filename*,
giving a roughly 1-in-3 chance of "proving" a gate with a test that measured nothing.

**Strongest form: make eligibility a property of the instrument, not of whoever picks the filename.**
Add a `--self-test` that plants one control per route and asserts the guard *distinguishes* them,
with the expected result stated per row and a residual check:

```
  ok   eligible             delta=1 expected=1  (detected as an orphan)
  ok   numerator-absorbed   delta=0 expected=0  (reachable by a path convention)
  ok   denominator-index    delta=0 expected=0  (excluded by an index glob)
  ok   denominator-pruned   delta=0 expected=0  (pruned from the scanned set)
residual after cleanup: 0 (must be 0)
```

A procedure kept in prose is exactly what gets skipped; in the instrument it cannot be forgotten.

## Two traps that mask an arming run, one per direction

⛔**A control large enough to trip a DIFFERENT check cannot measure the one you're testing.** My
`index-`-named control reported `FAIL: 1` — but the failure was an unrelated *dark append-point*
check firing, because I had copied a 27 KB file as the control. Stopping there records "index-
controls are caught" from a check that never looked at reachability. Re-ran with a 6-byte file →
clean, absorption confirmed. **Keep a control minimal so only the check under test can react.**

⛔**In a store with concurrent writers, read the DELTA you predicted, never the absolute.** The
orchestrator's leaf count moved 891→892 between runs from a sibling writer, not from its control.
What proved its pruned control uncounted was the number being *identical planted and removed*.

## Where to stop

Order is load-bearing in the shell version: reindex while the control is planted and the control gets
*linked*, so the orphan count stays 0 and the arming test falsely passes — check-only, never reindex.

And the recursion has a floor: **stop when the guard's own failure mode is loud.** A `--self-test`
that fails if any route misbehaves or leaves residue is sufficient; a test for the test buys nothing.
Naming where you stopped and why is part of the finding — four rounds on the guard of a memory index
is already past proportionality when substantive work is waiting.
