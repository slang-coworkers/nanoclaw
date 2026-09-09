---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T23:17:53.715Z
---

# [approver/challenger-miss] A count assertion constrains how many, never which — mutation-test the inversion, not just the removal

## Symptom

slang#12455's second revision deleted four explicit self-test assertions and kept a
count:

```python
check("catalog lint reports two issues", len(found), 2)
```

The commit message and a source comment both claimed the count subsumes one of the
deleted checks: *"the agreeing test staying silent, now implied by the count of
exactly two issues"* / *"The count of exactly two issues is what keeps the agreeing
test out."*

I reasoned the same way and agreed: a wrongly-flagged agreeing test would make the
count 3, so the assertion catches it. A critique disputed it. I mutation-tested
instead of arguing, and the critique was right.

## The measurement

Fixture: one agreeing test, one drifted test, one citing an unknown code.

| Mutation to the lint | `len(found)` | Verdict |
| --- | --- | --- |
| drift branch never fires (`if False:`) | 1 | **caught** — assertion fails |
| comparison inverted (`==` for `!=`): agree warns, drift silent | 2 | **survives** — `selftest: 0 failure(s)`, flagged = {`agree.slang`, `catalog.txt`} |

The inversion keeps the *cardinality* while swapping *identity*. Count 2, warn-only,
one unknown-code hit — every surviving assertion passes while the check now reports
the wrong file and misses real drift.

## Why I got it wrong

I tested the mutation the assertion was obviously designed to catch (delete the
behavior), saw it fail correctly, and generalized to "covered". That is testing the
easy direction and reporting the general claim. The mutation that matters for a
count is never *removal* — removal changes the count — it is any **rearrangement
that preserves the count**.

## The rule

**A count is a strictly weaker predicate than an identity check: it constrains how
many things happened, never which.** When a diff replaces `assert X is reported` +
`assert Y is absent` with `assert len(results) == 2`, the replacement is not
equivalent, and a claim that it is should be mutation-tested before it is believed —
including when the claim comes from the author's own commit message and source
comment, which is where I picked it up.

Mutation-testing recipe for a suspicious "the count covers it" claim (no build
needed for a Python lint):

```python
src = Path(target).read_text()
broken = src.replace("if a != b:", "if a == b:", 1)   # invert, don't delete
# exec the mutant module, run the kept assertions against the same fixture
```

If the mutant survives, the coverage claim is false and you have the demonstration
rather than an opinion.

## Generalization worth carrying

For any weakened assertion, ask: **what is the set of behaviors that still satisfy
it?** For a count, that set includes every permutation with the same cardinality —
which is exactly where a sign-flip, an off-by-one in the wrong branch, or a
swapped-arm bug lives. Sum checks, length checks, "N warnings emitted", exit-code
checks and "no errors" checks all share this weakness.
