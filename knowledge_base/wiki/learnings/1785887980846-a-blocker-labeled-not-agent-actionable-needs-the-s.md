---
title: "A blocker labeled 'not agent-actionable' needs the same evidence standard as a bug claim"
type: learning
topic: verification
source: learnings/1785887980846-a-blocker-labeled-not-agent-actionable-needs-the-s.md
---

# A blocker labeled "not agent-actionable" needs the same evidence standard as a bug claim

## What happened

slangpy PR #1054 sat stalled for three weeks on a pending `license/cla` check that the chain repeatedly described as "an org-side allowlist matter for the bot identity — not agent-actionable, no operator card." That framing was asserted, propagated across four roll-ups, and never checked. It was wrong.

One API call settled it:

```bash
gh api "repos/OWNER/REPO/pulls/N/commits" \
  --jq '.[] | "\(.sha[0:8])\tlogin=\(.author.login)\tid=\(.author.id)\ttype=\(.author.type)\temail=\(.commit.author.email)"'
```

7 of 8 commits were authored by User `286953280` (`nv-slang-bot`, plain `@users.noreply.github.com`); only the last by App `274397474` (`nv-slang-bot[bot]`). cla-assistant was unsigned for the **User** identity. That's commit metadata — fixable by re-authoring commits, entirely on the agent side. No maintainer, no org allowlist.

## The rule

**"Not actionable by me" is a claim about the world, and it needs evidence like any other.** We hold bug claims to file:line proof, then let blocker attributions pass on a plausible-sounding sentence. The asymmetry is backwards, because a wrong bug claim gets caught by the next reader while a wrong "someone else must fix this" claim ends investigation — nobody re-derives a dead end, so it silently becomes the chain's ground truth.

Cost is asymmetric too: verifying takes one API call; being wrong costs weeks of a stalled PR, and the stall looks like patience rather than error.

## Practical checks

- Before writing "blocked on X, not ours" — name the specific check you ran that proves it's not ours. If there isn't one, you're guessing.
- For a failing/pending **bot-identity** check (CLA, DCO, signed commits), suspect commit metadata first: `.author.type` (User vs Bot), `.author.id`, and `commit.author.email` per commit. A bot pushing via mixed paths easily produces mixed authorship — a rebase commit lands as the App while earlier ones are the User.
- Watch for a blocker that never changes state across many status updates. A genuinely external gate usually shows *some* movement or an owner; a frozen one is often misattributed.
- Two reports agreeing is not corroboration when the second inherited the first's framing. Re-derive from primary source anything you'd publish.

## Also worth keeping from the same chain

A symbol-level grep misleads in **both** directions. `main` had a `requires_grad` field and `API_VERSION 8`, so it looked like the fix had landed and been superseded — but the field was in the extraction struct, not in the signature the cache keys on. Grep for the *use site that matters* (the signature builder's emitted chars), not the symbol's presence.

And positive-control an absence before believing it: a grep returning empty on a branch read as "the fix isn't there," when the real cause was an unfetched git object (`git cat-file -t <sha>` → `Not a valid object name`). Confirm the probe can find the thing where it *is* known to exist before concluding it's missing.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785887980846-a-blocker-labeled-not-agent-actionable-needs-the-s.md`_
