---
title: "Key a root-cause memory lookup on the ENTITY (PR/issue number), not the symptom's signature"
type: learning
topic: misc
source: learnings/1785882088736-key-a-root-cause-memory-lookup-on-the-entity-pr-is.md
---

# Key a root-cause memory lookup on the ENTITY (PR/issue number), not the symptom's signature

## The failure

I re-derived a **refuted** root cause for the same PR, 90 minutes after refuting it, with the
correct answer sitting in my loaded memory index the whole time.

slang #12328 was evicted from the merge queue. Timeline, all verified at source:

```
18:16:41Z  SlangPy Tests  commit STATUS = failure   <- the real evictor
18:17:12Z  removed_from_merge_queue (31s later)
18:29:16Z  materialx job STARTS                     <- 12 min AFTER the eviction
18:44:35Z  materialx cancelled at 15m19s
```

I reported materialx as the **sole** evictor. It had not started when the PR was evicted.

## Root cause of the miss: retrieval keyed on the wrong thing

I asked memory *"what is a cancelled materialx job?"* — the **symptom's signature**. That routed me
to the materialx-ceiling file, which is **silent on #12328**, and I stopped there. Had I asked
*"what evicted #12328?"* — the **entity** — the index line names the commit-status cause outright.

Two properties made this survive:

1. **The symptom-keyed file was genuinely relevant** — materialx really did misbehave on that run
   (cancelled at 15m19s, a step killed mid-run, real coverage lost). It was a *true* finding about a
   *different* question. Two real defects on one commit, and **the louder, later one absorbed the
   earlier one's causal role.**
2. **The story was sufficient** — materialx explained a cancel, a lost step, and a queue problem, i.e.
   every visible byte. **No residual anomaly remained to prompt a re-check.** Sufficiency feels like
   confirmation.

## The rules

- **Key root-cause lookups on the ENTITY first** (PR/issue/commit id), then on the signature. Entity
  keys are unique; signatures are shared across unrelated causes.
- **A file that doesn't mention your entity has not answered your question** — even when it perfectly
  explains your symptom. Absence of your PR number in a signature file is a signal to keep looking.
- **For any "X caused Y", compare timestamps before asserting it.** Use the candidate's
  **`started_at`** vs the event, not just `completed_at` — a job that *began* after the event cannot
  have caused it. That's the whole refutation, one comparison.
- **Cross-link bidirectionally.** I added a stop-block at the top of the symptom file pointing to the
  entity file, so the wrong retrieval path self-corrects instead of dead-ending in a true-but-irrelevant
  answer.
- **Sweep scripts: an eviction happens on the MERGE-GROUP commit** (`gh-readonly-queue/...`), which is
  **nobody's PR head** — a head-sha-only loop never queries it on either surface.

Generalizes beyond CI: when a stored conclusion and a fresh derivation disagree, the fresh one is
*not* privileged by being fresh. It may simply be missing the retrieval that the stored one already did.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785882088736-key-a-root-cause-memory-lookup-on-the-entity-pr-is.md`_
