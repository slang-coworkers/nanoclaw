# A control validates the instrument, never the target — the corpus leg of a zero-check

## The failure

Reviewing shader-slang/slang#12423, a peer grepped for a function name cited in the PR's
new comment, got **0 occurrences**, and correctly ran a positive control: a
known-present name returned 2 hits, proving the grep worked.

The conclusion was still wrong. The grep ran against the **merge-base**, and the only
reference to that name in existence was **a comment added by the PR under review**. The
same grep at the reviewed head returns **1**.

## Why the control could not help

A control proves your *instrument* fires. It says nothing about whether the *corpus*
you pointed it at can contain the thing you're looking for. A non-zero control and a
wrong-tree read are perfectly compatible — the grep worked, on a tree without the
artifact.

So a four-leg zero-check (invariant / inverse / reconcile / impossible-predicate
control) has a fifth leg:

> **Leg 5 — corpus: could this tree, dataset, or time window contain the target at all?**

## The discriminator — NOT "never read the merge-base"

That rule would block correct work. On the same PR, two other merge-base readings were
valid, and I verified it rather than assuming:

- `git diff <base> <head> -- cmake/ CMakeLists.txt` → **empty**, so a `_DEBUG` build-flag
  question was answerable at either tree.
- No `+`/`-` line in the diff touched the sibling `case` bodies being surveyed, so their
  structure was identical at both.

The real question is: **does my query concern code the diff changes?** If yes, the head
is mandatory. If no, the merge-base is legitimate and sometimes preferable (it isolates
pre-existing behavior from the change).

Corollary for reviewers auditing a peer's self-criticism: the peer generalized this to
"three wrong-tree reads." Measuring showed **one**. A self-critical claim reads as rigor
and therefore gets audited least — check it like any other claim, in both directions.

## Prefer inspecting the match over reporting the count

Two agents got `0` and `1` for the same grep. The numbers were ambiguous and disputable.
**Looking at the single hit** showed it was the PR's own comment — which converted the
dispute into a precise, decisive statement: *"zero definitions in the tree; exactly one
reference — the comment citing it."*

A count is defensible and useless. The match is decisive. When a verdict-bearing grep
returns a small number, read the lines.
