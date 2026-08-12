# UNMERGEABLE in a merge queue is not a trigger — discriminate on headCommit, and treat "state outliving its cause" as the real anomaly

## The trap

`mergeQueueEntry.state == "UNMERGEABLE"` looks like an actionable stall. Two PRs on 2026-08-07 carried the identical state string and needed **opposite** responses.

| | #12363 — **act** | #12125 — **wait** |
|---|---|---|
| `mergeQueueEntry.headCommit` | `e287474` (batch formed) | **`null`** (no batch yet) |
| newest batch run | **terminally failed**, 34 success / 3 failure | none exists |
| cause | its own batch's failure | **inherited** from pos-1, still `in_progress` |
| own-head rollup | `SUCCESS` | `SUCCESS` |
| `reviewDecision` | `APPROVED` | `APPROVED` |
| `RemovedFromMergeQueueEvent` | none today | none ever |

**The bottom three rows are identical — they carry zero information for this question.** A discriminator is only established once you've shown the obvious candidates fail; green head checks, approval, and an empty removal timeline all feel diagnostic here and aren't.

## The static rule

```
headCommit == null  + nothing terminally failed
   ⇒ normal speculative-stacking backpressure. WAIT. (no run exists to rerun)
headCommit == <sha> + newest run on that branch terminally failed + entry still live
   ⇒ the sanctioned merge_group rerun
```

Firing on the state string alone would have meant a rerun against a **nonexistent run** — not merely wasteful but incoherent, since there's no object to act on.

## The better, dynamic rule

`UNMERGEABLE` at position N>1 is **inherited** from the entry ahead of it, so it should clear on its own once pos-1's batch goes terminal.

> **The state alone isn't the anomaly. The state surviving its cause is.**

Next-sweep test, falsifiable:
1. Is pos-1's batch run `status == "completed"`?
2. Yes, **and** the entry behind it is *still* `UNMERGEABLE` with `headCommit == null` ⇒ **anomaly, investigate.**
3. Pos-1 still `in_progress` ⇒ benign backpressure, no finding.

A static field check says "nothing to act on *right now*" and expires. Naming the cause gives you a condition whose disappearance is observable, so a genuinely stuck entry can't hide behind "backpressure" forever.

**Generalises beyond merge queues:** for any inherited or derived state, don't ask "is this state bad?" — ask **"has this state outlived what produced it?"**

## Queries

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){mergeQueue(branch:"master"){
  entries(first:20){totalCount nodes{position state
    headCommit{oid} baseCommit{oid} pullRequest{number}}}}}}'
```
Two PRs merging is **not** an empty queue — query `entries.totalCount` rather than inferring "drained" from merge events. (Both a peer and I made the read-a-change-as-a-terminal-state error within the same hour, on two different fields.)
