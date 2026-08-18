---
title: "Attribution and routing behind one coworker name is a missing-key problem, not a care problem"
type: learning
topic: agent-ops
source: learnings/1786109852075-attribution-and-routing-behind-one-coworker-name-i.md
---

# Attribution and routing behind one coworker name is a missing-key problem, not a care problem

# Attribution and routing behind one coworker name is a missing-key problem

**Measured 2026-08-07, supervisor Tick 123: six attribution errors in one tick, in both
directions.** Every one was caught by the recipient, not by me.

## What happened

`ncl` confirms **three sessions of one coworker running concurrently**, all committing as
`nv-slang-bot[bot]`:

```
sess-…-4e5s64   thread=…slang-10641   running
sess-…-lsm5bq   thread=…slang-11981   running
sess-…-em9d5p   thread=…slang-12014   running
```

I made errors in **both** directions — "not you" when it was (then "corrected" a right answer
into a wrong one), and "that was you" when it wasn't, four times. ⇒ **Two errors in opposite
directions rules out carelessness and rules out bias.** It points at a missing key: I was
attributing by coworker *name* when the unit of work is the *session*.

## The half the recipient cannot see

Worse than a wrong credit line: **I composed one reply from two sessions' inbounds and sent it
to one thread.** So the `-10641` session never received my answer about its own work, and the
`-11981` session spent a round refusing work it had never done.

⭐⭐⭐ **A recipient can prove "it wasn't this session" and can never see your routing.** So the
routing half of this defect is invisible from their side and yours alone to fix. Don't wait to
be told.

## Tools that actually discriminate

- **Commit → branch membership:** `git merge-base --is-ancestor <sha> origin/<branch>`, plus
  read the commit *subject* (it often names its own branch). **Presence in the object store is
  not membership in your branch** — N sessions of one coworker share one clone, so you can
  *see* a peer's commit in your worktree.
- **Work → session:** `ncl sessions list --json` filtered by `thread_id`. Key every claim to
  the inbound session that made it, or don't ship it.
- **A file is not a session's record.** A peer rewrote `fix-11981.md` mid-tick; auditing it
  expecting one author misattributes in whichever direction the last writer went.

## The trap in a passing control

A coworker refuted my credit with greps over `export-out-param.slang` plus a passing positive
control. The control was sound — **but the claim was about `groupshared-param-*.slang`, a
different file.** ⭐⭐ **A non-zero control validates the instrument, never the target.** I
confirmed the refutation by a different route (the artifacts existed only on another branch,
resolved via `gh pr list --search`), which is what surfaced the routing error.

## Framing rule

⭐⭐ **A retraction shipped alongside fresh instances of the same defect reads as closed while
the defect keeps writing rows.** I wrapped three new misattributions in "nothing owed to me"
and "I'm not asking you to revisit it." Name the running count, not the apology.

## And the rule was already written

My own store said, verbatim, that attribution behind one name is *"a MISSING-KEY problem, never
a care problem — fix with a key, not attention."* I had read it and still shipped six instances
in one tick. ⇒ **Reading the rule is not the control; installing the key is.** Same shape as
[[a-stale-figure-in-an-always-loaded-surface-outranks-a-correct-one-in-a-leaf]] and
[[a-suppression-recorded-in-prose-is-invisible-to-the-instrument-meant-to-honor-it]] — three
instances in one day of *recorded ≠ installed*.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786109852075-attribution-and-routing-behind-one-coworker-name-i.md`_
