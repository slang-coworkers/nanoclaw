---
title: "A hook-denied or failed verification probe means UNVERIFIED — never fall back to recording the relayed claim as fact"
type: learning
topic: verification
source: learnings/1785746988001-a-hook-denied-or-failed-verification-probe-means-u.md
---

# A hook-denied or failed verification probe means UNVERIFIED — never fall back to recording the relayed claim as fact

## The failure

2026-08-03, CI-babysitter chain on slang#11225. My parent reported that the downstream slangpy guard PR was "held as a draft pending a human promote-or-wait decision." I tried to verify it; my probe was **denied by a PreToolUse hook**. I then wrote the claim into durable memory and my own log *as fact*, with an explicit note that the probe had been denied — reasoning that the parent had already verified it via REST, so there was no coverage gap.

Nine minutes later the parent self-corrected: **no guard PR and no branch existed at all.** slangpy#1087 was an open *issue* only; the fixer was still mid-flight. I checked myself and confirmed: 25 open slangpy PRs, zero nvapi/capability-titled; `git/matching-refs/heads/1087` empty. The "draft-held" state I had recorded — and built a next-sweep disposition around — never existed.

## The rule

**A denied, blocked, failed, or skipped verification probe leaves the claim UNVERIFIED. It does not license falling back to the relayed version.** The two outcomes are not "verified" vs "verified-by-someone-else"; they are "verified" vs "unknown." Write it down as unknown.

What makes this trap effective is that it *feels* rigorous. I noted the denial, I attributed the source, and I reasoned explicitly about coverage — all of which reads like diligence while producing exactly the same corrupted record as blind acceptance. Transparency about how you failed to verify is not a substitute for verifying.

## What to do instead

- **Mark it, don't launder it.** `state=UNVERIFIED (probe denied)` in the record. A stated gap is recoverable; a laundered fact silently shapes later decisions.
- **Try another route before giving up.** My denied probe was one specific call. The plain `pulls?state=open` list and `git/matching-refs` both worked fine and would have caught the error immediately. One blocked path ≠ the fact is unreachable.
- **Weight by consequence.** This claim was load-bearing — it determined whether a persistent red meant "waiting on a human decision" or "fixer still working," which are different escalation postures. The more a fact drives your next action, the less relayed provenance is worth.
- **Relayed ≠ primary, even from your parent.** A parent's report is a secondary source that can be mid-flight, stale, or self-corrected later. Mine was, twice in one chain (it also corrected a `merge → tag` gate-ordering claim in the same window).

## Related

Generalizes the same failure mode as "verify a relayed premise at HEAD before posting" — but for the *recording* path, not just the posting path. Corrupt memory is arguably worse than a bad post: a post gets contradicted in public, whereas a bad memory quietly reshapes every later sweep that reads it.

**Distinct from [`1779847439047-resume-after-pause-re-verify-remote-state-before-a.md`](1779847439047-resume-after-pause-re-verify-remote-state-before-a.md)** — same remedy (re-verify against primary source), different trigger, so both are kept:
- *That* one: state that was **verified once and went stale** across a multi-day pause. Trigger = resuming from a saved memo. Failure = acting on a true-when-written fact.
- *This* one: state that was **never verified inside a live turn** because the probe was blocked. Trigger = a denied/failed probe plus an available relayed claim. Failure = laundering the relay into the record.

Cross-link added by Main 2026-08-03 (`/workspace/shared` is Main-write-only; the babysitter identified the neighbour and correctly declined to merge them).

## Postscript — the parent made the same class of error, one tier up

The relayed "draft-held" claim originated with **me (Main)**, and it is worth recording why, because the mechanism differs from the babysitter's and is the more insidious of the two. I had verified — correctly, via REST — that *no* `1087` branch or PR existed. I then escalated to the operator asking whether to **promote the guard out of draft**. That question presupposes a draft. So I did not fail to verify; I verified the true state and then wrote a **downstream framing that contradicted my own finding**, because I was reasoning ahead to the decision the chain would eventually need.

**The rule that catches this:** when you escalate a decision, re-read the question against the state you just verified and check that its *presupposition* holds right now — not that it will hold once work in flight completes. "Promote the draft?" and "no draft exists" cannot both be true. A forward-looking framing smuggles an unverified premise into a human's decision queue, which is worse than a stale fact in a log because a human may act on it.

This pairs with the existing rule that a drafted public comment must not carry stronger claims than its backing memo: same defect, different surface — the phrasing outran the evidence while every underlying fact stayed correct.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785746988001-a-hook-denied-or-failed-verification-probe-means-u.md`_
