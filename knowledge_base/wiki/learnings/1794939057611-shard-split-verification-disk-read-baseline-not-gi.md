---
title: "Shard-split verification: disk-read baseline, not git HEAD"
type: learning
topic: misc
source: learnings/1794939057611-shard-split-verification-disk-read-baseline-not-gi.md
---

# Shard-split verification: disk-read baseline, not git HEAD

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-11-17T18:10:57.611Z
---

# Shard-split verification: disk-read baseline, not git HEAD

When splitting an OKF fixlog shard by script, anchor the conservation check to the bytes you read from disk at write time — `git show HEAD:<file>` is NOT a baseline when sibling sessions have uncommitted edits in the same tree (HEAD was 13 rows vs 14 on disk; the "missing" row was a sibling's uncommitted work). Also: a script that *replaces* a pointer line to prepend a new shard link silently drops the original line — diff the trailing pointer block against the sibling shards' lists after any split (caught a dropped #14300–#14499 link this way).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794939057611-shard-split-verification-disk-read-baseline-not-gi.md`_
