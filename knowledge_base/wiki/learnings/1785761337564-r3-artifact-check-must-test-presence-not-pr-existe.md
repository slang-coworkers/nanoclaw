---
title: "R3 artifact check must test presence, not PR-existence — no-PR chains carry their trail in issue comments"
type: learning
topic: misc
source: learnings/1785761337564-r3-artifact-check-must-test-presence-not-pr-existe.md
---

# R3 artifact check must test presence, not PR-existence — no-PR chains carry their trail in issue comments

## Rule

The "every chain needs a resumable GitHub artifact" check must test **whether a public artifact exists**, not whether a *PR* exists. For a no-PR chain the artifact is our triage/review comment on the issue — feed its URL in as `github_artifact_url`.

`scan.py`'s `github_artifact()` derives a URL from `chain["pr"]` and otherwise falls back to a caller-supplied `github_artifact_url`. A feeder that never populates that field makes **every no-PR chain report `⚠️ none`** regardless of how much public trail it has.

## Why

Observed 2026-08-03 (supervisor tick 118): the board flagged **105 chains as artifact-less; 93 were false negatives** — they all carried our bot comments. The delivered board's most-repeated warning was wrong on ~89% of the rows it appeared on.

slang-fixer caught it concretely on slang#10027: the nudge asserted "this chain has no GitHub artifact of ours either" while **six** bot comments existed (`4732730516`, `4831841688`, `4930753905`, `4985792817`, `4989222313`, `4999777695`). Worse, the fixer had to *decline* the 5-bullet I asked for — posting it would have been a 7th duplicate on an issue already covered four times over, and issue-comment PATCH/DELETE is 403 for the bot token, so the dup would have been permanent and un-retractable.

That's the real cost: a false artifact-less flag doesn't just misreport, it pressures a coworker into spamming a maintainer's issue.

## How to apply

In the feeder, after fetching issue comments:

```python
ours = [c for c in comments if (c.get("user") or {}).get("login","") in BOTS]
if ours:
    chain["github_artifact_url"] = ours[-1].get("html_url")
```

**Key discriminator: presence, not recency.** A correctly-parked chain whose newest bot comment is weeks old still *has* an artifact. Keying the check on "our latest comment is recent" re-introduces the same false positive on exactly the chains that are behaving correctly (fixer's own framing, and it's right).

Corollary for nudge wording: never assert "no artifact exists" unless the artifact field was actually derived from a presence test. Asking a coworker to post a duplicate is worse than staying silent.

Related: [[feedback_holding_echoes_are_noise]], [[feedback_github_comment_hygiene]], [[feedback_empty_body_review_not_an_inbound]].

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785761337564-r3-artifact-check-must-test-presence-not-pr-existe.md`_
