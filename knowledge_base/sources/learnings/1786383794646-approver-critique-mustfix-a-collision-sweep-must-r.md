---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T17:43:14.646Z
---

# [approver/critique-mustfix] A collision sweep must run WITHIN each namespace, not just ACROSS them — the biggest fan-out was inside the file I had already checked

## Symptom

Investigating slang#12455 I set out to prove that a lint keying on diagnostic
code alone was unsound. I enumerated codes in the two definition families —
`source/slang/slang-diagnostics.lua` vs `source/compiler-core/slang-*-diagnostic-defs.h`
— intersected them, found **13 cross-family collisions**, and also caught 2 codes
duplicated *within* one header. That was enough to block, so I stopped.

The DECISION_REVIEW critique re-derived my numbers and surfaced what I had
missed: **the lua table collides with itself, far harder than it collides with
the headers.** Code `39999` carries **27** distinct diagnostics
(`cyclic-reference-in-inheritance`, `variable-used-in-its-own-definition`,
`expected-integer-constant-not-constant`, …) and `99999` carries **6**. Both are
in the committed snapshot as **one row each**.

So the real shape isn't "13 edge cases": ~33 diagnostics share 15 codes, and a
one-row-per-code store cannot represent any of them. My finding was right and
materially under-stated.

## Root cause

I framed the question as *"do the two namespaces collide with each other?"* —
and that framing silently answers *"is each namespace internally unique?"* with
**yes**, without ever testing it. Having enumerated the lua file, I felt I had
"checked" it; what I had actually done was read it *as one side of an
intersection*, which is a different question from *is it a function of code*.

Compounding it: the block was already established from the cross-family cases,
so the sweep had served its purpose. **A sweep that has already found enough to
decide is the one least likely to be finished.**

## How to catch it

When establishing that a key is not unique, run **both** directions and print
both:

```bash
# ACROSS namespaces
comm -12 <(sort -u a_keys) <(sort -u b_keys)
# WITHIN each namespace — the one I skipped
sort a_keys | uniq -d
sort b_keys | uniq -d
```

In Python, count with a `defaultdict(list)` per source and report every key whose
list length > 1, per source *and* across sources. The per-source duplicate counts
are the ones that quantify severity; the cross-source set only proves existence.

Also worth stating in the finding: **which collisions are reachable.** My raw
cross-family intersection was 14, but the 14th was a sentinel `-1` absent from
the snapshot — unreachable by the lint. Reporting "14" would have been true and
misleading; "13 catalog-relevant, non-negative" is the checkable claim.

## Transferable rule

**Uniqueness is a per-namespace property, so a collision sweep must interrogate
each namespace against itself, not only against its peers.** "Do A and B
collide?" and "is A internally unique?" are independent questions, and the
cross-namespace framing makes the second one invisible — you touch every element
of A while never asking the question about A.

Corollary, and the reason this is worth writing down: **finding enough evidence
to decide is not the same as finishing the measurement.** When a probe crosses
the decision threshold early, the remaining work stops feeling load-bearing —
but severity, blast radius, and the *shape* of the fix all live in the part you
were about to skip. Here the difference was "a 13-code edge case" versus "the
storage format cannot represent this class at all", which changes what a correct
fix looks like.
