---
title: "CI terminal is not chain terminal — a maintainer approved 6 minutes before two agents declared the chain closed"
type: learning
topic: ci-tooling
source: learnings/1785970543490-ci-terminal-is-not-chain-terminal-a-maintainer-app.md
---

# CI terminal is not chain terminal — a maintainer approved 6 minutes before two agents declared the chain closed

A PR review chain reached terminal CI (34 of 37 jobs green). Two agents independently moved to close it. **The maintainer had approved six minutes earlier and answered the review's central open question in the same comment** — and neither of us had that, because we were both watching CI.

```
22:40:12Z  last CI leg completes                    -> we called it "terminal"
22:46:11Z  maintainer APPROVED
22:47:16Z  maintainer: "approve and merge as is. Please make another PR for the follow up"
22:50Z     the fixer agent's context compacted      <- the approval fell inside its window
22:54Z     peer's summary still read "closed on all three sides"
```

## The defect

**Treating *CI terminal* as *chain terminal*.** A true measurement of one thing standing in for a question about another. Our watchers were armed on the workflow run; **nothing was armed on the PR's review state**, so the single event that actually resolved the chain arrived unobserved by three parties.

The scope question it settled had been open across three full review rounds (extend the fix to sibling functions, or keep it narrow?). The answer — *narrow now, sweep in a follow-up PR* — was sitting in a review comment while we were reconciling job counts.

## Rules

1. **Before declaring any chain closed, re-read live PR state**: `reviewDecision`, `reviews[]`, and comments since your last check. CI terminal is one input to the verdict, not the verdict.
2. **A peer announcing a context compaction is a trigger to re-verify and re-brief, not a reason to go quiet.** Anything that landed inside their window is gone from their context and still true in the world. I only caught the approval because I re-verified live state before writing that handoff instead of restating my own summary — one `gh` call, and it was the highest-value message of the review.
3. **Set the resume trigger on whatever actually advances the chain** — here "maintainer merges, or the follow-up PR needs writing," never anything CI-shaped. A trigger pointed at the wrong artifact is why the state change went unseen.
4. **`mergeStateStatus=BEHIND` on an approved head belongs to the maintainer.** It renders as a UI warning, so "helpfully" rebasing feels like progress — but force-pushing over an approved head can dismiss the approval, destroying precisely what three rounds of review were working toward. Same family as a draft-flag guardrail: **a state a human deliberately set is a state only they should change.**

## A bonus trap in the maintainer's own words

His request was *"apply the fix to all other sibling functions whose return type is `SlangResult`"* — **base-class framing**, which provably cannot reach one implementation that inherits the interface directly rather than the shared base. That's the same enumeration defect (subclasses-of-a-base vs implementors-of-an-interface) that four agents had already committed earlier in the same review, now recurring in the maintainer's phrasing. **It has to be stated explicitly in the follow-up PR or the gap survives a second time** — and a maintainer's framing gets less scrutiny than a peer's, which is exactly why it needs the same check.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785970543490-ci-terminal-is-not-chain-terminal-a-maintainer-app.md`_
