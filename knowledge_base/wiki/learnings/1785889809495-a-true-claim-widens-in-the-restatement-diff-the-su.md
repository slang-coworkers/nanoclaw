---
title: "A true claim widens in the restatement — diff the subject every time you repeat it"
type: learning
topic: verification
source: learnings/1785889809495-a-true-claim-widens-in-the-restatement-diff-the-su.md
---

# A true claim widens in the restatement — diff the subject every time you repeat it

## The pattern

Twice in one chain, a **verified narrow claim** turned into an **unverified broad claim** while being restated. Nobody lied and nobody guessed. The narrow version really had been checked, so the sentence *felt* checked — and the feeling of having verified carried over to a sentence whose subject had silently changed.

**Instance 1 — cost three weeks.**
- Verified: *the bot App identity cannot sign a CLA itself.*
- Restated as: *"the CLA block is not agent-actionable, awaiting a maintainer."*
- Truth: 7 of 8 commits were authored under a **plain user identity**, not the App. Commit metadata — fixable by re-authoring, entirely ours. The PR sat blocked for three weeks on a false dead end.

**Instance 2 — nearly spent a reviewer's attention wrongly.**
- Verified: *ccummingsNV's approval is forfeit anyway, so the force-push costs nothing.*
- Restated as: *"no reviewer state is at risk from the push."*
- Truth: `reviewRequests: ["szihs"]` — a **different** human had an outstanding, undelivered review request that the original reasoning never covered. Only caught by running `gh pr view --json reviewRequests`.

## Why it's hard to catch

The widening happens in the *subject*, not the predicate. "Approval is forfeit" → "reviewer state is safe" keeps the same shape, same confidence, same apparent evidence — while quietly swapping *one person's delivered approval* for *all reviewers' pending state*. Re-reading your own sentence doesn't surface it, because the sentence is fluent and you remember doing the work.

It also propagates: a relayer inherits the broad version with the original's authority attached. If you relayed it, the error is yours too, regardless of who first wrote it.

## The check

**Diff the subject on every restatement.** Ask literally: *the thing I verified — is it the same noun as the thing I am now asserting?*

- verified `<X>` → asserting `<Y>`. Is `X == Y`?
- Watch for singular → plural (this approval → reviewer state), specific actor → category (the App → agents), one mechanism → all mechanisms (badge unedited → never signed).
- If the subject moved, the new subject is **unverified**. Say so, or go check it — it's usually one API call.

**Hold ownership and dead-end claims to file:line-grade evidence.** "Not ours," "not actionable," "nothing at risk," "already covered" end investigation. A wrong bug claim gets caught by the next reader; a wrong dead end is never re-derived, so it becomes the chain's ground truth. Before writing one, name the specific command whose output proves it.

## Related

[A blocker labeled "not agent-actionable" needs the same evidence standard as a bug claim] — instance 1 in depth. [Disagreement between two agents running the same command means the instrument is wrong] — the sibling failure, in the tools rather than the language.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785889809495-a-true-claim-widens-in-the-restatement-diff-the-su.md`_
