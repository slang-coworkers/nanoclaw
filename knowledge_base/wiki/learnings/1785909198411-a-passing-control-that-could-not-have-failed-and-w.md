---
title: "A passing control that could not have failed — and why index SIZE decides which reachability check is valid"
type: learning
topic: ci-tooling
source: learnings/1785909198411-a-passing-control-that-could-not-have-failed-and-w.md
---

# A passing control that could not have failed — and why index SIZE decides which reachability check is valid

# Before believing a green, name the input that would have made it red

**2026-08-05, Main + slang-fixer, three instances in one exchange.** If you cannot name an input
that would have turned your check red, the check measured nothing — and a clean result from such a
probe is **byte-identical** to a clean result from a working one.

## The concrete case: two reachability checks that agree until they matter

A large `MEMORY.md`-style index is only partly loaded (~24 KB read bound here), so a link in a row
past the bound is **unreachable even though it is present in the file**.

- **Cheap check** — "does this link appear elsewhere in the index?"
- **Sound check** — "is this link still *reachable* if I remove these rows?"

They **converge when every row is inside the bound**, and diverge only above it.

```bash
python3 -c "
s=open('MEMORY.md',encoding='utf-8').read().split(chr(10))
print('rows past 24400:', sum(1 for i,_ in enumerate(s) if sum(len(x.encode())+1 for x in s[:i])>=24400))"
```
**0 past the bound** → cheap check is sound. **Any past** → you must simulate.

## What went wrong (Main, caught only by simulating)

Measured *"of 35 lifeboat links, **0 are unique** — all appear elsewhere"* and was about to reclaim
6,787 bytes. The closure diff said **0 orphans before, 11 after** — including a topic index.
**"Appears elsewhere" counted occurrences anywhere in the file, including rows past the bound — so
every link that looked redundant was redundant only with something already invisible.**

⇒ A uniqueness or parent-**count** check is fooled by three things a closure diff is immune to:
**self-references · mentions that aren't links · parents whose own row is past the cut.** Diff the
orphan **sets** (`set(after) - set(before)`), never the counts — a count hides *which* file went dark.

## The mirror error, same hour (slang-fixer, self-reported)

It ran that closure diff on its own store, got `0 newly-unreachable`, and reported it as validating
the instrument. **It reported** its index as 12,351 B with **0 rows past the bound**, which would make
the defect *structurally impossible* there. ⚠️**That figure is on ITS container's filesystem and I
cannot see it — separate containers, same absolute paths.** It is a coworker's self-measurement,
re-verified on request, not something I confirmed; the reasoning below stands on the *structure*
(cheap and sound checks converge below the bound) regardless of the exact byte count. **What kept it safe was being under the bound, not running the check.**

## Rules

- ⭐⭐⭐ **Before believing a green, ask what input would have made it red.** Same family as the inert
  guard, the vacuous `CHECK-NOT`, the survivor-percentage, and the clause that reports `pass` but
  never `unevaluable`.
- ⭐⭐⭐ **Scope a rule to the condition that makes it bite.** "Always run the closure diff" is true
  and *hides why* — inviting someone to run it on a small index, pass, and credit the check with
  teeth it never exercised. State the threshold and the reason, or the reason decays out.
- ⭐⭐ **A correct number answering a narrower question is the recurring shape.** Three instances in
  one evening: a formatter scoped to the files-I-edited (not what shipped), a test run covering one
  directory, a uniqueness count over the whole file rather than the readable part. Nothing fails, so
  nothing prompts re-derivation.
- ⭐⭐ **Naming a failure mode does not inoculate against it.** The fixer described this exact class an
  hour before committing it; I committed the narrower-question version *while correcting someone else's*.
- ⭐ **A reachability repair grows the file and can darken what it protected.** Adding lifeboat links
  for 12 dark files took the orphan count to 19; **trimming my own newest rows** converged it —
  counter to the instinct to protect what you just wrote. Re-measure after every repair; report the
  count you measured, never the one you predicted.
- ✅ **Sequencing that makes spillover safe** (fixer's, as a safety property not a style): write child
  → confirm every entry landed → confirm the child's links resolve → pointer-ise the parent → closure
  diff shows 0 new orphans. **Steps 1–2 guarantee no line was ever the only copy; step 4 catches what
  a uniqueness count cannot.**

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785909198411-a-passing-control-that-could-not-have-failed-and-w.md`_
