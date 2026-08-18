---
title: "A vendor status page is a LAGGING indicator — measure the queue, stratified by the class you gate on"
type: learning
topic: agent-ops
source: learnings/1786042035800-a-vendor-status-page-is-a-lagging-indicator-measur.md
---

# A vendor status page is a LAGGING indicator — measure the queue, stratified by the class you gate on

## The method

During any provider incident, do not decide whether to retry from the status page. Measure your own **queue depth + median wait**, and **stratify by the class you actually gate on**.

Verified twice on 2026-08-06 during a GitHub Actions `major_outage` (shader-slang/slang).

## Why the status page fails

At the 18:43Z probe the page had not updated in **32 minutes** while the fleet degraded measurably. Component enums also carry stale `updated_at` stamps. And the *prose* of an incident update outperforms the component color: "self-hosted runners may see errors or rate limiting when runners **register**" named the exact fault class that kills GPU legs — information no status color conveys.

## Why an aggregate fails

```
                    18:20Z          18:43Z
queued/pending      103        →    100      ← IMPROVED
median wait         51.4 min   →    67.3 min ← worse
max wait            75.0 min   →    99.7 min ← worse
terminal completions 3 (light) →    ZERO     ← worse
```

⭐⭐⭐ **The aggregate improved while the gating class went to zero completions.** Read as "queue shrinking ⇒ recovering," it inverts the correct call. Recovery is *stratified*: cheap hosted runners come back first, self-hosted GPU pools last. So sampling the aggregate during a partial recovery over-weights whichever class recovers fastest.

The gating-class probe settled it — workflow `CI` (the self-hosted GPU legs):

```
17:00Z→18:44Z: 10 runs → 8 queued/pending (incl. 2 merge_group stuck), 2 completed/SKIPPED
⇒ ZERO terminal CI runs since 17:13Z
```

## ⛔ The trap inside the trap: `skipped` satisfies `status == "completed"`

A recovery check phrased *"did anything complete?"* counts a skipped run as evidence of health. It isn't — it's the `filter` job short-circuiting, so **no leg ever ran**. In the window above, the *only* "completed" CI rows were skipped ones.

**A recovery claim needs a terminal `success`/`failure` in the gating class.** Both `cancelled` and `skipped` mean UNTESTED. `skipped` is the easier miss precisely because it *is* completed. Bucket 4-way with `status` before `conclusion`: success / failure / cancelled+skipped (untested) / non-terminal.

## Sharpest single figure

A trivial check — `Verify PR Labels` — stuck **72 minutes**. It isolates queueing from any GPU-or-code question: nobody can argue a label check is slow because of a shader bug.

## How to apply

1. `GET /repos/{o}/{r}/actions/runs?per_page=100`, paginate, bucket 4-way, compute wait ages from `run_started_at`.
2. Require a fresh terminal success **in the gating class**, not the aggregate.
3. Read the incident **text**, not the component enum.
4. Two probes minutes apart beat one snapshot — a *trend* distinguishes draining from filling.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786042035800-a-vendor-status-page-is-a-lagging-indicator-measur.md`_
