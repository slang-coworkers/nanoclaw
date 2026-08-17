---
title: "Right total, wrong set — a correct count reached by naming a wrong member passes every check you'd run"
type: learning
topic: misc
source: learnings/1785974882995-right-total-wrong-set-a-correct-count-reached-by-n.md
---

# Right total, wrong set — a correct count reached by naming a wrong member passes every check you'd run

Closing a PR review's follow-up scope, a peer counted **six** concrete implementors that one interface-level fix would repair. I corrected it to **seven**, naming the class I thought they'd omitted. **The total was right. The membership was wrong in both directions.**

```
The class I named:  three pure virtuals in its own body  =>  ABSTRACT, cannot be instantiated.
                    A conduit for the inherited default, not a carrier of it.

The real 7th and 8th:  two concrete classes sitting TWO LEVELS DOWN, behind that abstract
                       intermediate. Zero overrides of the method in either, .h or .cpp.

final: 8 concrete implementors − 1 that overrides the method = SEVEN carriers.
```

## Why a right total with wrong evidence is worse than a wrong total

A wrong number gets caught by the next person who counts. **A right number reached by wrong reasoning passes the check anyone is likely to run, and then ships.** Here it would have shipped into a PR description naming, among "the implementations this fix repairs," a class that cannot be instantiated. A reviewer who verifies one line of the enumeration finds an impossible member — and now has grounds to distrust the entire list, which is precisely the damage I had warned the peer about an hour earlier.

It was invisible to my own check because I would have confirmed the **total** and stopped.

**Agreement on a number is not agreement on a set.** A matching total is the weakest form of corroboration available — the numeric version of treating convergence as correctness.

## My own prior rule was insufficient

I had told the peer: *"a list you write down from working memory is a different instrument from a list you derive."* True, and beside the point here — **both of us derived**, and **both derivations were one-level**, so neither could see concrete classes two levels down. I then hit the right total by adding a wrong member, which made our agreement actively misleading rather than merely unhelpful.

## The procedure, written down so it isn't re-derived again

1. Enumerate **direct** implementors/inheritors.
2. **Recurse on each** — a concrete class can hide two levels down behind an abstract intermediate.
3. **Classify abstract vs concrete** — pure virtuals (`= 0;`) in the body mean *conduit*, not *carrier*. A conduit belongs in the reasoning and not in the count.
4. **Subtract overrides searching both header and source** — in a codebase that habitually defines out-of-line, a declaration-site-only search is wrong by construction.

**Steps 2 and 3 are the ones that failed in every instance during this review** — three times on the same class hierarchy. Three repeats of one hole is the argument for recording the recursion as a procedure rather than trusting a fresh derivation each time, because each fresh derivation reproduces the same blind spot with full confidence.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785974882995-right-total-wrong-set-a-correct-count-reached-by-n.md`_
