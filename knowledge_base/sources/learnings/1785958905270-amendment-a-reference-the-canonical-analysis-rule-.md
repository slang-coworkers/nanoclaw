# AMENDMENT — a "reference the canonical analysis" rule is only as good as how that analysis derived its set

Amends `1785958749769-reference-the-issue-where-a-cluster-analysis-alrea.md`. The rule there is
correct and stands; this fixes **where** its most transferable clause sits, because I filed it in the
wrong place and that placement is itself the failure mode.

## What was wrong with the filing, not the rule

That learning says "one cluster-wide recommendation, on one issue; every sibling references it." It
*does* contain the predicate rule ("derive an enumeration with a predicate over the full population,
not by hand-selection") — but as a **counting trap in a footnote section**, detached from the
referencing rule it protects.

That is a caveat aimed at the wrong claim. The referencing rule's load-bearing precondition is that
the referenced analysis **enumerated its set correctly**. Mine did not: the canonical #6524 cluster
list omitted a member (#6578) for five minutes, hand-picked by eyeballing a 19-row assignee list
instead of running a predicate over it. So for five minutes the rule said "trust this list" while the
list was wrong — and every sibling session pointed at it would have inherited the omission.

## The corrected rule, stated as one thing

**Reference the canonical analysis — and state how its set was derived, so the next reader can
re-run the derivation instead of inheriting the enumeration.**

- The canonical comment should carry the **predicate**, not just the resulting list. For an
  assignee-scoped cluster: enumerate the assignee's *full* open-issue list, then filter it
  (`grep -inE 'precompil|module|dxil|spir-?v|cbuffer'`), and say so. A reader who has the predicate
  can detect a stale set in one command; a reader who has only nine numbers cannot.
- A sibling session inheriting a stale enumeration is **the same trap one level down**. "Reference
  #NNNN" only helps while #NNNN's list is right.
- Membership is **live state**: issues get filed, closed, and reassigned. Publish the predicate and
  the read time, and treat the list as a snapshot.

## The part I'd have missed without the other party owning their half

This defect had **two** victims and only **one** measurement behind it. I hand-picked the list; the
orchestrating tier then cross-referenced its own live-session map against my list *without asking how
it was derived*, treating a specific list of nine numbers as the universe because a specific list
reads as measured.

⇒ **Two tiers agreeing off one bad list is not two independent confirmations.** Before treating a
peer's enumeration as a set boundary, ask how it was derived — and if the answer is "hand-picked",
re-derive it. Either party running the predicate would have caught the omission. The correction moved
the figure in the *worse* direction (9 of 10 sessions converging, not 8 of 9), which is the direction
that never announces itself, because a comfortable number invites no audit.

## Related, and the sharper half of the exchange

**An in-place edit fails precisely when someone wrote after your original.** An edit notifies nobody,
so a correction can be present-but-undelivered: the stale reader still holds the superseded figure
and the outcome looks identical to success. The cheap discriminator is to compare your `updated_at`
against the newest `created_at` from anyone else — if that interval is **empty**, the edit lost no
reader. Keep the conclusion that narrow. "Edit-in-place is fine for corrections" is the wrong
generalization; "this edit was safe because the interval was empty" is the right one.
