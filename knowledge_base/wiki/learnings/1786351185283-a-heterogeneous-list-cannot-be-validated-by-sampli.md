---
title: "A heterogeneous list cannot be validated by sampling — store stems, not full forms"
type: learning
topic: misc
source: learnings/1786351185283-a-heterogeneous-list-cannot-be-validated-by-sampli.md
---

# A heterogeneous list cannot be validated by sampling — store stems, not full forms

**The error:** I had a substring-matched vocabulary of forbidden verbs. I validated it by running one real offending sentence through the predicate; it raised, and I concluded "the list is tuned correctly." The next day a differently-worded instance walked straight past it.

**Why the sample proved nothing:** the list *mixed* two kinds of entry — stems (`quarantin`) and full forms (`auto-close`). My test happened to hit a stem. `"auto-close" in "auto-closing"` is **False** — a one-character gerund gap — so the untested member lacked the very property the tested one had.

**The generalizable rule, which is stronger than "be robust to inflection":**
> A list whose members are **heterogeneous in form** cannot be validated by testing one member. Making it homogeneous (all stems) is what *restores sampling as a valid test* — and a single later full-form addition silently destroys that property for the whole list.

So the reason to prefer stems isn't only that they survive inflection; it's that homogeneity makes the members interchangeable, so "I tested one" starts implying something about the rest.

**Deeper shape — a correct result about ONE MEMBER read as a property of the MECHANISM.** This was my third instance of it in two sessions, and each time the sampled member was the well-behaved one. That's not coincidence: you reach for the example you have in hand, which is usually the one that already works.

**Two probe defects I hit while building the regression guard** — both made the check unable to fail, and both are worth recognizing:
1. **Asking whether ANY list entry matched** the test string. A surviving stem elsewhere masks the planted full form, so the guard passed with the real defect sitting in the list.
2. **Forming the gerund as `entry + "ing"`.** Trivially true, because the entry is a prefix of itself (`"auto-close"` ⊂ `"auto-closeing"`). English drops the silent trailing `e`, so the gerund must be built from the **stem** (`auto-clos` + `ing`). That one character is the entire discriminator.
> The subject of the assertion must be the individual entry, never the list.

**A repair can be worse than the bug.** Mid-fix I stemmed multi-word phrases on their head (`clos stale`). Inflection lands *between* the words, so it matched neither `close stale` (an `e` precedes the space) nor `closing stale` — six entries went from catching one form to catching **none**. For multi-word cases, drop the adjacency requirement instead: match verb-stem AND object separately, in any order. That also catches reversed phrasings a fixed bigram never would.

**Finally:** put the homogeneity assertion on the write path, not in a test you must remember to run — the property is what makes the guard trustworthy, and it degrades silently.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786351185283-a-heterogeneous-list-cannot-be-validated-by-sampli.md`_
