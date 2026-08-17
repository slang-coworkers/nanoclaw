---
title: "Resolve a chat-reported bug against GitHub before proposing it as a new issue"
type: learning
topic: misc
source: learnings/1785831640500-resolve-a-chat-reported-bug-against-github-before-.md
---

# Resolve a chat-reported bug against GitHub before proposing it as a new issue

## The failure mode

A Discord/Slack bug report that is *already filed and already fixed* can read as a live,
unfiled defect — especially when:

- the messages are still inside the channel's recent-N window (so they look current);
- the reporter **self-retracted partially**, in a way that doesn't cover their whole claim.

I hit this today and had to correct my own draft mid-report.

## Concrete case (shader-slang/slang, 2026-08-04 sweep)

In #slang-dev, `crossvr` (2026-07-29) reported that after `InterlockedAdd`, the
`slang-ir-byte-address-legalize` pass retyped **all** `RWByteAddressBuffer` instances to
`RWStructuredBuffer<uint32_t>`, leaving `Load`/`Store` passing **byte** offsets where
**element** indices were expected → out-of-bounds reads in emitted C++.

Then he wrote two retractions:
- "doesn't seem to be a regression, since the first version to support it already had this issue"
- "this seems to be the intended behavior of the pass, so false alarm on my part"

…and **kept going** with the byte-vs-element indexing concern. So the thread reads as:
*retracted the regression framing, but the silent-corruption claim is still standing and
unfiled.* That is a compelling "should we file this?" shape.

**Reality:** it was issue **#12265**, filed by the reporter the same day, **closed
2026-07-31 via merged PR #12267** (`20c33490e6`). Root cause was exactly his hypothesis —
`babType->replaceUsesWith(...)` on the **shared, deduplicated** type instruction flipped
every buffer in the module. Fix gated the `IRParam` branch on
`translateToStructuredBufferOps`. Two regression tests landed, including a mixed U64/U32
atomic-width case a maintainer surfaced during review.

## The rule

Before reporting any chat-sourced bug as new/unfiled, **search the issue tracker for it** —
by symptom keywords, by the reporter's username, and by the pass/file name they cite. A
one-call `github_search_issues` check is far cheaper than a false "needs a GitHub issue"
action item, which costs a maintainer real attention.

Corollary: **a reporter's partial retraction is not a resolution signal in either
direction.** Don't drop the report because they said "false alarm", and don't escalate it
because part of the claim survived. Go check the tracker.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785831640500-resolve-a-chat-reported-bug-against-github-before-.md`_
