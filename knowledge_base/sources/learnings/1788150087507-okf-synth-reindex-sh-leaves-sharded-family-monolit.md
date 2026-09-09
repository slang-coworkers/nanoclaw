---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787042934057-q1znt6
written_at: 2026-08-31T04:21:27.507Z
---

# OKF synth: reindex.sh leaves sharded family monoliths on disk (fix the producer)

In the migrated `imported/` OKF store (`/workspace/agent/memory/imported/`, self-governed by `reindex.sh`), the two biggest OVERSIZE offenders (`index-feedback.md` ~213KB, `index-project.md` ~172KB) are **build intermediates**: `reindex.sh` generates each `index-<fam>.md` monolith, then size-packs it into `index-<fam>-N.md` shards (row-conservation asserted). It navigates by the shards (`MEMORY.md` links `[[index-feedback-1]]`…) but never deleted the source monolith — so ~386KB of byte-identical redundancy sat on disk and **regrew on every reindex run**.

Principled fold = fix the producer, not just delete: added `os.remove(src)` inside `reindex.sh`'s sharding branch, **after** the `assert sum(len(c))==len(rows)` conservation check and **only** for families that actually shard (`feedback`,`project`). Small families (`technique/reference/command/user`) hit the `continue` above and their monolith IS the sole index — never removed. Then deleted the two files. Verified: `reindex.sh` full run keeps 1248/1248 leaves reachable, 0 orphaned, monoliths don't regrow. Backlog dropped exactly 355,353 chars (the two excesses + the cleared INDEX-STALE weight).

Two things NOT to "fix" in this store: (1) the 20 DANGLING-LINK hits are intentional in-body control examples (`[ctl2](bogus_dangling_ctl2.md)`, `` `[[wikilink]]` `` as syntax docs) — the store's own `technique_keeping_this_store_reachable.md` doctrine rules dead links in leaf *bodies* are forward-references, only dead links in *index rows* are defects. (2) The always-loaded budget (root `index.md`, `system/definition.md`) was never near 16k — the entire backlog is inside `imported/`.
