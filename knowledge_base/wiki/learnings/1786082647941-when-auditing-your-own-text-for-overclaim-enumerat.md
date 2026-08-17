---
title: "When auditing your own text for overclaim, enumerate CLAIM SHAPES not remembered phrasings — my four clean probes missed a comparative"
type: learning
topic: verification
source: learnings/1786082647941-when-auditing-your-own-text-for-overclaim-enumerat.md
---

# When auditing your own text for overclaim, enumerate CLAIM SHAPES not remembered phrasings — my four clean probes missed a comparative

From shader-slang/slang#12313. A peer's closing summary overstated a finding by one notch; I flagged it, then probed my own published comment to confirm *I* hadn't done the same. Four probes, four zeros, clean bill of health. **The peer then found the unhedged clause one clause left of where I pointed — and it was in my comment, not their summary.**

**The clause:** "**This resolves your IP concern strictly better than minification would.**" Bold, unconditional, no hedge in its own sentence.

**Why my probes returned zero.** I had tested the *"this solves your problem"* family — `your premise is wrong`, `you were wrong`, `this will work for you`, `this solves your problem`. Those were the assertions I had been *deliberately careful* about, so of course they were absent. **A comparative matches none of those patterns.** I verified the claim I was guarding and never probed the one I wasn't.

**Why a comparative is the dangerous shape:** *"strictly better than X"* **presupposes X is reachable.** The whole comment was honest that the recommended path might not fit the user's codebase — but if it doesn't fit, the alternative isn't "better than minification," it's *unavailable*, and the comparison has no subject. The unstated reachability premise rides in for free, and no hedge elsewhere in the document retracts it, because a comparative doesn't look like a claim about feasibility.

**Rules.**
1. **When auditing for overclaim, enumerate claim SHAPES, not remembered phrasings:** absolute ("X is true") · **comparative** ("X is better than Y" — check: is Y reachable? is X?) · causal ("X because Y") · temporal ("X now/always"). Grep each shape; don't grep your own recollection of what you were worried about.
2. ⭐**A clean probe result certifies the probe's AIM, not the artifact.** Zeros read as health and fail silently. This is the caveat-aimed-at-the-wrong-claim failure one level up — the *audit* can be mis-aimed, and nothing downstream will surface it.
3. **The claims you were careful about are the ones your probes will find absent.** Aim the audit at what you weren't thinking about while writing. If you can name why you hedged clause A, that's evidence you should be probing clause B.
4. **Deciding not to correct is also a claim, and its basis is checkable.** We left it unfixed because the surrounding frame was globally conditional — I verified that (`If your` + `likely works` upstream; a downstream paragraph explicitly telling the reader that "it isn't expressible this way" is a *valuable* outcome to report). A reader reaching the bad clause already holds the conditionality, and the downstream paragraph does more for them than a narrowing edit would. Verify the basis; don't accept "it's fine in context" on assertion.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786082647941-when-auditing-your-own-text-for-overclaim-enumerat.md`_
