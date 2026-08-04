---
title: "An empty-body review is not an inbound — check body length before flagging awaiting_us"
type: learning
topic: review-process
source: learnings/1785761122402-an-empty-body-review-is-not-an-inbound-check-body-.md
---

# An empty-body review is not an inbound — check body length before flagging awaiting_us

## Rule

When computing ball-direction for a PR chain, a review event counts as a **human inbound only if it carries text**. Check `body|length > 0` on `pulls/{N}/reviews` before treating a maintainer review as "human spoke last, unanswered by us".

An **empty-body `APPROVED`** is a go-ahead click. An **empty-body `COMMENTED`** is just the wrapper GitHub creates around inline comments (which live at `pulls/{N}/comments` and must be fetched separately). Neither is something a human is waiting on a reply for.

## Why

Treating a wordless approval as an inbound **manufactures a reply obligation that doesn't exist**, and the "fix" is worse than the miss: it puts noise on a maintainer's notifications by thanking them for clicking Approve.

Observed 2026-08-03 (supervisor tick 118): slang-rhi#805 was nudged because skallweitNV's 10:02:45Z event looked like an unanswered human comment. It was an empty-body `APPROVED`. slang-triager checked all four surfaces that could hold text — PR reviews (1, body empty), PR issue-level comments (none), PR inline review comments (none), issue comments (only our own bot) — and correctly **refused to post**. The nudge also inverted the timeline: our 10:10Z outbound came *after* 10:02Z and already was the response.

Applying the `substantive` filter flipped the row from `awaiting_us`/`action=nudge` to `awaiting_human`/`action=none`, and `must_nudge` 7→6.

## How to apply

In any supervisor/board feeder that ingests reviews:

```python
rbody = r.get("body") or ""
substantive = len(rbody.strip()) > 0
# drop non-substantive reviews entirely — ball-direction only sees author/at/is_bot,
# so a wordless approval left in the list reads as "human spoke last, unanswered"
```

Then fetch `pulls/{N}/comments` separately for the actual review text. Dropping the empty wrapper *without* ingesting inline comments would swing the error the other way and hide real review feedback.

**Corollary — don't over-retract.** In the same tick I doubted a *correct* signal: szihs' 11:48Z events on #12080 also had `body:0`, but that author was genuinely mid-burst (substantive inline replies at 06:46/08:03, 11 force-pushes in 5h). The empty wrapper there sat on top of real activity. The discriminator is always "is there text on some surface", never "is the newest event empty".

Related: [[feedback_holding_echoes_are_noise]], [[feedback_never_relay_a_verdict_not_in_hand]].

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785761122402-an-empty-body-review-is-not-an-inbound-check-body-.md`_
