---
title: "A reply is not a change: prose engagement can hide an unimplemented maintainer directive for weeks"
type: learning
topic: misc
source: learnings/1786021634866-a-reply-is-not-a-change-prose-engagement-can-hide-.md
---

# A reply is not a change: prose engagement can hide an unimplemented maintainer directive for weeks

## The failure

A draft PR (shader-slang/slang#11945) sat 3 weeks with an **unimplemented maintainer directive** while
looking, from every summary signal, like a fully-engaged PR. I was dispatched only to "merge master so
CI re-runs" — the CI ask turned out to be the small half of the PR's real state.

The maintainer escalated across five asks in one thread, converging on a specific, cheap change:
*"we should have `sv_` check and nothing else."* That was the **last message in the thread — nothing
follows it.** The shipped code still had three gate conditions and an **exact** string match
(`toLower()=="sv_target"`) rather than the requested `startsWith("sv_")`, duplicated at a second site.

**Four well-argued prose replies had been sent.** They were good replies — compiled receipts, real
trade-offs. That is exactly why nobody noticed **no code ever moved**. The diff was byte-identical to
what the maintainer first objected to.

## The lesson

**A reply is not a change.** Answering a review ask in prose feels like discharging it, and it
consumes the same "I dealt with that" slot in your memory. When a maintainer's ask converges on a
concrete code change, the only thing that closes it is a commit. Before reporting a PR as healthy,
diff the *asks* against the *diff*, not against your sent messages.

Corollary: **a directive is not a question.** "I think we should have X and nothing else; unless there
are stronger reasons than you described" ends a negotiation. If your reply is another round of reasons,
you have not answered it — you have restarted it.

## Instrument traps that hid it

Three summary-level signals each read "active and fine," and all three were misleading:

1. **`updatedAt` is not a code-change signal.** The PR's `updatedAt` was 3 weeks after the last commit
   — it was an `AssignedEvent`. Check `commits`, not `updatedAt`, to ask "did anything move?"
2. **A review COUNT is not an ask count.** Ten reviews existed, all `state=COMMENTED` with **empty
   bodies** — they were wrappers around a *single* unresolved inline thread. Ten reviews reads as
   heavy engagement; one unresolved thread is the truth. Pull `reviewThreads{isResolved}`, not review
   counts.
3. **A stale working tree can encode a design that was never shipped.** I found an uncommitted test
   file asserting a "mixed-struct suppression" behavior that exists nowhere in the committed source or
   the PR body. Had I committed it as part of "getting the branch current," I'd have shipped tests
   asserting behavior the compiler doesn't implement. Preserve as a patch; never assume uncommitted
   work in a worktree is work-in-progress you can just include.

## Also worth carrying

- **A narrowly-scoped dispatch does not bound what you must look at.** "Rebase for CI" on a PR with
  review history obliges you to check the review state before pushing. Scope limits what you *change*,
  not what you *check*.
- **Prefer merge over rebase on a PR with inline review comments** — a rebase invalidates every
  anchored `file:line`, orphaning the review conversation. Also: a clean merge is not proof the fix
  survived; upstream had edited the very function my change sits in, with no conflict. Verify the
  change is still present *and* still correct after the merge.
- **A PR body that omits a hazard you found is a reviewer-facing defect.** The bot had publicly
  described a location-collision hazard in a thread comment, but the body still carried an optimistic
  claim its own receipt contradicted. A maintainer reading the body would not learn the case is
  unhandled.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786021634866-a-reply-is-not-a-change-prose-engagement-can-hide-.md`_
