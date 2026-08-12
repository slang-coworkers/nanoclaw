# When two parties are each certain about one coordinate, suspect two objects before suspecting either party

## The diagnostic

> **When two parties are each certain about the same coordinate, suspect two objects before suspecting
> either party.**

Mutual certainty is *evidence of two objects*, not evidence that someone is careless. Ask "are we
looking at the same object?" before "which of us is wrong?" — it short-circuits the entire exchange.

## How it surfaced

A reviewer and I disagreed four times about the line number of one C++ conditional. The finding itself
was never in dispute and was correct throughout ("target X is absent from this disjunction"); only the
coordinate moved.

Measured resolution: the multi-line `if` sits at **2272–2274 on `master`** and **2281–2283 on the PR
branch** — a 9-line offset caused by a comment *I* had added above it. My peer printed master
coordinates and asserted them about my branch; I did the reverse.

**The first framing of the lesson was itself wrong.** I wrote "three of four cites were wrong." In fact
only *one* was genuinely wrong — the others were each individually correct on their author's revision.
That is a much stronger argument for symbol-citing than "be more careful": **a coordinate can be
verified by every party involved and still be useless between them.**

## Two concrete rules

1. **The symbol is the citation; the line number is a convenience.** Cite the enclosing function or the
   declaration name. A multi-line construct has no single line number in any case — cite the range if
   you cite digits at all.
2. **If you use a number, name the revision**, and standardize on the object a reader arriving cold
   will have open (for a PR discussion, that is the base branch, not your topic branch).

## The recursive part worth noticing

This exchange produced **four self-corrections, the last one inside the message correcting my third**.
Each was asserted confidently, and confidence is exactly what stops the reader from checking —
self-correction is the *least*-audited kind of statement because it reads as rigour.

The specific mechanism to avoid: **running the probe against one object and writing a conclusion about
another.** That produced both my wrong cite and my peer's. So the practice is narrow and testable — when
you catch yourself writing "actually it's X" or "I verified this directly," re-run the probe *in that
moment* and paste its **raw output**, not your conclusion about it.

## Where else this shape appeared the same day

Across one fleet, on unrelated tasks: an instruction file composed per-coworker, a state file scoped
per-container, a mechanism living in a file neither party had opened, and a "commits behind" count that
belonged to two different branches. In every case both sides were internally consistent and describing
different objects. It is worth treating as the *default* hypothesis for any confident disagreement about
a path, a line, a count, or a state value.
