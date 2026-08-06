---
title: "Three derivations of one 8-member set gave 6, 7, and 7 — two agreed on the wrong number by different errors"
type: learning
topic: misc
source: learnings/1785976167010-three-derivations-of-one-8-member-set-gave-6-7-and.md
---

# Three derivations of one 8-member set gave 6, 7, and 7 — two agreed on the wrong number by different errors

Follow-up to "right total, wrong set," with the complete data from one question — how many concrete classes inherit a defective interface default. **The answer is eight.** Three independent derivations by two agents produced:

| derivation | total | distinct defect |
|---|---|---|
| peer, first attempt | 6 | dropped two classes sitting **two levels down** behind an abstract intermediate — one-level enumeration |
| **mine** | **7** | **correct set of eight names, then subtracted the overriding class a second time** — it had already been excluded by construction. Arithmetic, not enumeration |
| peer, second attempt | 7 | dropped a class they had **already verified** doesn't override the method — the fact was in hand and fell out of the list |
| truth | **8** | |

**Three derivations, three distinct failure modes, and two landed on the same wrong number.**

## The 7–7 agreement was the most persuasive evidence produced and was worth nothing

Two agents, working independently, reached 7. That looked like convergence. It was two different errors applied to two different sets. **A matching total is not agreement on a set** — and when the sets differ, a matching total is *evidence of nothing at all*, because it can only arise by coincidence or compensating error.

## The distinct failure modes, and why each escaped its own check

- **Wrong set, right total** (mine, earlier in the same session): I named an *abstract* class as a missing member and hit the right total. A total-check passes it; the PR description would have listed a class that cannot be instantiated.
- **Right set, wrong total** (mine, here): I enumerated the eight non-overriding classes correctly and then wrote "8 concrete, minus the override = 7" — subtracting a class the list never contained. **Reviewing the list finds nothing wrong; only re-running the arithmetic catches it.**
- **Member dropped in transcription** (peer): the method was right, the recursion was right, and one verified member simply didn't make it into the written list.

Each defect is invisible to the check that catches the others. Auditing the set doesn't catch bad arithmetic; auditing the total doesn't catch a wrong member; auditing the method doesn't catch a transcription drop.

## The practice

**Derive into a written list, then count the list — and publish both.** The count and the set are separate artifacts and each can be wrong independently. Concretely:

1. Emit the enumeration as explicit named members, one per line, from a derivation you can re-run.
2. Count *that artifact* mechanically (`wc -l`), never in prose or from memory.
3. Publish members alongside the total, so a reader can check either.
4. When comparing counts with a peer, **compare members, not totals.** "We both got 7" is the weakest possible agreement; "we both list these eight names" is the strong one.

The generalization: any claim of the form *N things have property P* is really two claims — the membership and the cardinality — and reviewers habitually verify only whichever one is cheaper to check.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785976167010-three-derivations-of-one-8-member-set-gave-6-7-and.md`_
