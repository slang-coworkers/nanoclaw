# Cite pre-existing lines by CONTENT, not line number — branch numbers are the most ephemeral ref and rot into squash-merge commit messages

Follow-up to the "a line citation is meaningless without its ref" lesson, from the same review (shader-slang/slang#12353). Three base-vs-branch line offsets landed in one review; the fix is not "pick the right ref" but **stop citing lines for unchanged code.**

## The case

A PR body needed to cite an in-tree precedent — a comment recording that diagnostic code 99996 was *"moved from 99999 to avoid severity conflict with internal-severity diagnostics at that code."* That citation was **load-bearing**: it's what turns "a future renumbering could happen" into a documented precedent.

```
master   :465 comment  :466 standalone_note("note-failed-to-load-dynamic-library", 99996, …)
PR head  :472 comment  :473 standalone_note(…)              <- +7, the PR's own added diagnostics
         :465-468 at PR head = a completely different diagnostic
git diff master..head -- slang-diagnostics.lua | grep -c '^[+-].*99996'   ->  0   (note untouched)
```

Two reviewers cited it two ways; both were correct for their own ref. My first correction ("use the branch number") was **also wrong**.

## Why the branch number is the worst choice

- It breaks on any rebase, and on any insertion above it — **including by the PR itself**, which is exactly what produced the +7 here.
- A future reader lands on **master**, not your branch, and finds unrelated code at that line — reproducing the confusion permanently.
- On a squash-merge repo the PR body **becomes the commit message**, so a branch-pinned pointer to unchanged code is embedded forever, guaranteed to be wrong.

## The rule

**For an unchanged, pre-existing line, cite content — not a line number.**

> `standalone_note("note-failed-to-load-dynamic-library", 99996, …)`, whose comment records that the code was *"moved from 99999 to avoid severity conflict."*

The symbol and the comment text are both greppable and neither drifts. If a line number is wanted for convenience, give **master's** and label the ref explicitly (`@master`), since master is what a reader has checked out.

For lines the PR *does* change, branch numbers are fine — the diff is the context.

## Corollary

A **citation-checking predicate is itself ref-sensitive**: "does the cited line contain the named token?" passes against whichever tree it ran in. It must record that ref, or a later clean pass is unfalsifiable. Same trap one level up.

## The generalizable shape

A pointer's stability is part of its correctness. A citation that is true today and rots tomorrow is a claim with an undeclared expiry — the same family as an absence check over a mutable index, or a point-in-time read of a working tree reported as a state. **Prefer identity-based references (content, symbol, blob hash, run-key) over position-based ones (line number, directory name, recency) whenever the artifact can move.**
