---
title: "Wake payload `evicted` can be a FALSE-NEGATIVE, not only a false positive — check recall, not just precision"
type: learning
topic: ci-tooling
source: learnings/1786011778780-wake-payload-evicted-can-be-a-false-negative-not-o.md
---

# Wake payload `evicted` can be a FALSE-NEGATIVE, not only a false positive — check recall, not just precision

## The correction

The stored position on the Slang CI wake payload's `evicted` field was "0-for-7, treat as ABSENT, an
always-wrong signal." Measured again 2026-08-06 10:00Z, that framing was **incomplete in a way that
can cause a miss**:

- `evicted` named **#12309** with the **correct** `mergeGroupRunId` (31071418861) — a genuine
  `failed_checks` eviction at 05:53:28Z, confirmed by `RemovedFromMergeQueueEvent` in the timeline.
- `evicted` **omitted #12363** — an equally genuine `failed_checks` eviction (2026-08-05T14:01:51Z),
  still stranded 20h later with `mergeQueueEntry=null` and a fully green head.

So this sweep the field scored **precision 1/1, recall 1/2.**

## Why this matters

"Always wrong ⇒ ignore it" and "sometimes right ⇒ trust it" are both wrong readings. The field has
**two independent failure modes** and a tally that mixes them hides one:

- **False positive** (names a non-eviction) → wasted investigation. Loud, self-correcting.
- **False negative** (omits a real eviction) → a PR sits stranded with a green head and *nothing
  prompts anyone to look*. Silent, and silence is indistinguishable from "no evictions."

A precision-only score ("it was wrong about the one it named") can read as *fully characterized*
while recall was never measured. Ask which direction the error pushes the **action**: a false
positive costs minutes; a false negative costs an indefinitely stalled PR.

## How to apply

Re-derive evictions **independently every sweep** regardless of what `evicted` says — including when
it is `[]`, and including when the entry it gives you turns out correct. Enumerate
`RemovedFromMergeQueueEvent` over every recent merge-group branch:

```bash
gh api -X GET "repos/OWNER/REPO/actions/runs?event=merge_group&per_page=100" \
| jq -r '.workflow_runs[] | select(.run_started_at > "<cutoff>") | .head_branch' \
| sed -E 's#.*/pr-([0-9]+)-.*#\1#' | sort -u
# then per PR: timelineItems(itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT, ADDED_TO_MERGE_QUEUE_EVENT,
#                                      AUTO_MERGE_ENABLED_EVENT])
```

Treat the payload entry as a **hint to cross-check, never as the population**. Verifying an entry it
supplied tells you nothing about the entries it withheld — the omissions are the expensive half, and
they are only findable by enumerating the surface yourself.

Corollary for reporting a signal's quality: state precision and recall separately. "0-for-N" collapses
them and invites the reader to conclude the signal is merely noisy when it is actually *lossy*.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786011778780-wake-payload-evicted-can-be-a-false-negative-not-o.md`_
