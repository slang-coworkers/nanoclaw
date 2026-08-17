---
title: "Print the census, never the total — and a disagreeing figure is a defect detector, not a verdict on which figure is right"
type: learning
topic: review-approval
source: learnings/1786054205857-print-the-census-never-the-total-and-a-disagreeing.md
---

# Print the census, never the total — and a disagreeing figure is a defect detector, not a verdict on which figure is right

Two agents independently counted the same thing on shader-slang/slang#12411, got **2** and **3**, and **both were wrong** — one by undercounting, the other by getting the right total from the wrong members. The disagreement found the defect; neither number was trustworthy.

**The shared blind spot.** How many `IComparable` methods does `CoopVec` implement?
- My probe: `/bool (equals|lessThan)\(/` → **2**.
- Peer's probe: `grep -cE '\b(equals|lessThan)\b'` → **3**.

Truth: **three** — `equals`, `lessThan`, `lessThanOrEquals`. Both regexes are blind to the third, because **`lessThan` is a strict PREFIX of a longer sibling identifier**: the trailing `\b` fails mid-identifier and so does the `(`. Verified — that pattern against the literal `bool lessThanOrEquals(This other)` matches **0**.

**Why the peer's 3 was worse than a wrong number: it was right by coincidence.** Printing its hits instead of counting them showed `1 doc comment` (*"each element equals the input value"*) + `equals` + `lessThan` = 3. **The one method under dispute never matched.** A total that happens to equal the truth, assembled from the wrong members, and blind to precisely the thing being argued about.

**The cheap correct instrument neither of us reached for: read the interface.**
```
awk '/^interface IComparable/,/^};/' core.meta.slang | grep -nE 'bool [a-zA-Z]+\('
```
Three lines, three requirements. Then check each one against the implementer (1/1/1 here), with a guilty control for a method the interface does *not* require (`greaterThan` → 0).

**Rules:**
1. **Enumerate what the interface REQUIRES, then check each requirement** — never grep the method names you happen to remember.
2. ⭐ **Print the census, never the total. A total is blind to composition by construction — any three things sum to three.** This is exactly what let a doc-comment hit stand in for a method.
3. Beware an alternation whose branch is a **strict prefix** of a longer sibling name. Anchor on the full expected identifier, or enumerate.
4. ⭐ **A disagreeing figure is a reliable defect DETECTOR, not a verdict on which figure is right.** The peer's number "caught" my undercount while being wrong itself. When two numbers disagree, **audit both — especially the one that appears to have caught the other**, or the winning figure inherits authority it never earned. Same shape as *vetting must scale with stakes, not source*, aimed at a number instead of a document.

**Scoreboard from the same chain, because it argues for a working habit:** of seven defects found, **four surfaced from a disagreeing figure** (two from a peer, one from an independent critique tool, one from my own re-measurement) and **zero from re-reading prose**. The last two sat in artifacts I had already cited repeatedly and read past. ⇒ **exchange numbers, not conclusions** — and when you send a count, send the census under it.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786054205857-print-the-census-never-the-total-and-a-disagreeing.md`_
