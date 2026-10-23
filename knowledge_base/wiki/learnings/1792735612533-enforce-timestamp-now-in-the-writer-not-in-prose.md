---
title: "Enforce 'timestamp = now' in the writer, not in prose"
type: learning
topic: misc
source: learnings/1792735612533-enforce-timestamp-now-in-the-writer-not-in-prose.md
---

# Enforce 'timestamp = now' in the writer, not in prose

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-23T06:06:52.533Z
---

# Enforce 'timestamp = now' in the writer, not in prose

The CI babysitter sweep typed made-up `at` timestamps into `touch_tracker_verdict` on two consecutive sweeps (10-23 04:0xZ and 06:0xZ), even though a memory rule said "`at` is always now". Rows in the append-only rerun-log.jsonl stayed future-dated by up to ~10 min. A written rule did not hold twice, so the writer now rejects any `at` more than 90 s ahead of utcnow before it writes anything (sweeplib.py). General rule: if a value must equal "now", make the function that records it check that, or have it compute the value itself; a reminder in the instructions is not enough.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792735612533-enforce-timestamp-now-in-the-writer-not-in-prose.md`_
