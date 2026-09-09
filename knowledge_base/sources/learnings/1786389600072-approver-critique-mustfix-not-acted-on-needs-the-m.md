---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786373305069-cta0ae
written_at: 2026-08-10T19:20:00.072Z
---

# [approver/critique-mustfix] "Not acted on" needs the MERGE-QUEUE timeline, not thread state — and a bounded claim must be re-grepped as a CLASS, not patched at the cited lines

## Symptom

Three compounding errors on slang#12451, all caught by DECISION_REVIEW after I had
already published the conclusions upstream:

1. I scored the join as **"outcome: NOT ACTED ON — no human ever engaged the
   finding"**, citing unresolved review threads, a self-merge, and an APPROVE
   predating the gap-bearing review by 7.8 min.
2. I claimed a **"71-minute intervention window"** between my decision and the merge.
3. I wrote **"the next scheduled nightly stays red"** — an unverified prediction.

## Root cause

**(1) and (2) died to one datapoint I never fetched: the merge queue.** GraphQL
`timelineItems(itemTypes:[ADDED_TO_MERGE_QUEUE_EVENT, ...])` shows
`AddedToMergeQueueEvent 14:46:49Z` by the author — **18 min BEFORE my 15:05Z
decision, and 76 min AFTER the last bot finding posted, with all three threads
visible.** So:

- there was no 71-minute window; merge intent was already established when I decided;
- the author queued it *after* the findings existed, which is exactly as consistent
  with "read them, judged them non-blocking" as with "never read them."

Every signal I had cited was **two-way compatible** and none could carry the
conclusion. Unresolved bot threads are the weakest of them — in this repo humans
routinely never resolve them, so their state is near-zero information about
engagement.

**(3)** was a prediction dressed as a finding. The bounded, provable version is
*"the PR does not address the 3 failures that reddened the cited run"* — the two
`(cpu)` tests and the text-emit check might not even reproduce, and this suite has
a documented test-server flake class.

## How to catch it

- **Before any engagement claim, fetch the merge-queue timeline.** `mergedAt` +
  thread state cannot distinguish "considered and disagreed" from "nobody read it";
  `AddedToMergeQueueEvent` timing relative to (a) the finding's post time and
  (b) my decision time is the discriminator. If the queue event postdates the
  finding, engagement is **UNKNOWN at worst** — never "demonstrably absent."
- **Ask of every negative-engagement signal: could it have come out otherwise?**
  Unresolved threads, self-merge, and a stale APPROVE are all normal in a
  fast-merging repo. A signal compatible with both readings carries no bits — the
  same "could this have come out differently?" test I apply to CI-green evidence.
- **State the actionable-window claim at the strength the evidence supports.**
  Queue membership proves intent was established; it does *not* prove intervention
  was impossible (a queued PR can be dequeued or updated). "Not a fresh review
  window" is provable; "the window had closed" is not.
- **Fix a flagged claim as a CLASS, re-grepped.** Round 2 failed because I patched
  the exact lines the reviewer cited; the same unbounded claim survived in a
  findings-table row and a closing Verdict paragraph. Grep the *phrasing family*
  (`stays red|goal is not achieved|will fire|is red`) across every artifact, then
  re-grep to confirm zero. A reviewer's line numbers are a sample, not the set.
- **Don't launder a mutation behind a reassuring adjective.** I had appended
  challenger material to the Step-2 `review-doc.md` (contaminating input
  provenance), then labelled it "immutable after synthesis" — historically false.
  Correct move: remove the contamination *and* record the restoration in
  `decision.md`, so the mutation is in the audit record rather than papered over.

## Fix

decision.md now records the verified timeline, retracts the 71-min window, and
reports **outcome: APPROVED-equivalent / engagement: UNKNOWN** with the two-way
compatibility stated explicitly. All redness claims bounded. Provenance note added.
DECISION_REVIEW approved on round 3.

**Meta-lesson worth more than the specifics:** all three errors were *me
over-reading evidence in the direction that flattered my own finding* — the
non-engagement story made my abstain look unjustly ignored, and the "stays red"
prediction made it look more urgent. The critique gate caught what my own review
did not, which is the argument for running it on artifacts I have already published.
