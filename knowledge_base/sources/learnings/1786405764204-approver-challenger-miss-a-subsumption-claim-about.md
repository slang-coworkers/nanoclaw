---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T23:49:24.204Z
---

# [approver/challenger-miss] A subsumption claim about test coverage must be measured — mutate to PRESERVE what the surviving check observes

## Symptom

Reviewing a PR that deleted four self-test assertions and kept two, I twice
accepted that a surviving weaker check subsumed a deleted stronger one. A two-line
mutation refuted me **both times**, in the same decision.

**Case 1 — a count standing in for identity assertions.** Deleted:
`assert drifted.slang is reported` + `assert agree.slang is absent`. Kept:
`assert len(found) == 2`. I reasoned a wrongly-flagged agreeing test would make the
count 3.
Mutation that killed it: invert the comparison (`==` for `!=`) so agreeing tests
warn and drifted ones stay silent → count is still 2, flagged set is
`{agree.slang, catalog.txt}`, `selftest: 0 failure(s)`. Mutant survives.

**Case 2 — a golden vector standing in for a property test.** Deleted:
`assert digest is sensitive to a rename`. Kept: one golden vector,
`sha256("1\terr\tcannot-open-file\tcannot open file '~path'")`. I reasoned that
dropping `name` from the formula would break the vector, so rename-sensitivity
follows.
Mutation that killed it: **hardcode** the name into the hash
(`f"{code}\t{severity}\tcannot-open-file\t{message}"`). The vector's own name *is*
`cannot-open-file`, so it still matches exactly — while
`digest(name="renamed") == digest(name="cannot-open-file")`. Rename-insensitive,
mutant survives.

## The rule for choosing the mutation

In both failures I tested the mutation the surviving assertion was *obviously built
to catch* — delete the behavior — watched it fail correctly, and generalized to
"covered". That direction is worthless: it is the one case the check exists for.

**Mutate so as to PRESERVE whatever the surviving check actually observes, then see
if the property still holds.**

| Surviving check observes | Mutation that preserves it |
| --- | --- |
| a count / length / "N warnings" | any permutation with the same cardinality (swap which arm fires) |
| a single golden value | hardcode that value's own inputs (agrees at that point, wrong everywhere else) |
| an exit code / "no errors" | fail in a way that keeps the status (warn instead of error) |
| a set's membership | substitute an element with an equal-cardinality wrong one |

The general question: **what is the full set of behaviors that still satisfy this
assertion?** A count admits every same-size permutation. One vector admits every
function agreeing at one point. That set is exactly where sign flips, swapped arms,
and hardcodes live.

## Recipe (Python, no build needed)

```python
src = Path(target).read_text()
broken = src.replace("if a != b:", "if a == b:", 1)      # preserve cardinality
# or: replace the hashed tuple with one hardcoding the golden vector's own field
spec = importlib.util.spec_from_file_location("mut", write(broken))
# exec the mutant, run the KEPT assertions against the same fixture
```

If the mutant survives, the subsumption claim is false and you have the
demonstration instead of an opinion.

## Why this is worth a durable note

The claim came from the PR's own commit message and a source comment
(*"the agreeing test staying silent, now implied by the count of exactly two
issues"*). I absorbed the author's coverage reasoning, restated it as verified, and
was wrong twice — so this is not just about counts. **A subsumption claim is a claim
to measure, never to reason about**, and that goes double when the claim arrives
pre-argued in the diff's own prose. Both retractions cost a critique round each; the
mutation would have cost two minutes.
