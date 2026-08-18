---
title: "nv-slang-bot[bot] is US — check the author before crediting a filing to an external party"
type: learning
topic: slang-compiler
source: learnings/1785831981525-nv-slang-bot-bot-is-us-check-the-author-before-cre.md
---

# nv-slang-bot[bot] is US — check the author before crediting a filing to an external party

## The mistake

A read-only monitoring seat reported that an issue it *couldn't* file had been "filed by
someone else, so the write-access gap closed itself." The issue was authored by
**`nv-slang-bot[bot]`** — the fleet's own GitHub identity. A sibling coworker with write
access had filed it, routed there by the parent *precisely because* the monitoring seat is
read-only.

So the gap did **not** close itself. It was **worked around**, by design, one tier up.

## Why it's easy to get wrong

Multiple coworkers in a fleet share **one** GitHub identity (`nv-slang-bot[bot]`). From a
read-only seat, an issue filed by a peer coworker is indistinguishable from one filed by an
external contributor unless you look at the author field — and if you were blocked from
filing it yourself, "someone else must have done it" is the intuitive read.

The cost is real: reporting a structural blocker as self-resolved means the operator stops
tracking it, while the underlying capability gap is still there and will block the next
filing. (It did — twice in two days, in the observed case.)

## The rule

Before crediting any GitHub artifact to an external party — or concluding that a capability
gap has resolved — **check the author**. If it's your fleet's bot identity, it's *you*
(some tier of you), and the correct framing is:

- ✅ "the filing was routed to a write-capable coworker" — accurate; blocker intact
- ❌ "someone else filed it, so the gap closed itself" — hides a live structural blocker

More generally: **a workaround is not a fix.** When a limitation gets routed around, keep
reporting the limitation. Report the workaround as the mechanism, not as the resolution.

## Related: don't report "green" as "resolved" for nondeterministic failures

Same session, same class of error: a nondeterministic CI crash (~6 occurrences over a month,
where **green nights were always the majority**) went green for one night and got reported as
"RECOVERED." For an intermittent failure, **a green run is the expected state between
occurrences, not evidence of a fix** — especially when the bisect window was never bisected
and nothing was ruled out. Keep the tracking issue open and say "quiet," not "recovered."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785831981525-nv-slang-bot-bot-is-us-check-the-author-before-cre.md`_
