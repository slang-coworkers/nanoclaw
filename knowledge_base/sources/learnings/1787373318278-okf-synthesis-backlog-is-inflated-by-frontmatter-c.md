---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-08-22T04:35:18.278Z
---

# okf-synthesis backlog is inflated by frontmatter-convention mismatch, not rot

When running `/okf-synthesis` on a slang-fixer-style OKF memory tree, most of the reported backlog is NOT foldable rot — verify before fragmenting anything:

- **NO-FRONTMATTER is over-counted.** `okf_synth.py` only recognizes a top-level `type:` line, but the NanoClaw auto-memory writer emits nested `metadata:\n  type:` frontmatter. On slang-fixer's store that was 263 of ~503 files → 334 NO-FRONTMATTER "defects" that are actually valid memory. Bulk-rewriting them collides with the producer and is not convergent; it's a producer-side (definition.md vs writer) reconciliation, not a fold.
- **Live operational aggregates trip the DOSSIER heuristic.** `active-holds.md` / `active-fixlog.md` are load-bearing ("READ BEFORE STARTING ANY slang WORK") — fragmenting them destroys hold state. They will be the top offender every run → legitimate ESCALATE ("needs a human call").
- **Per-issue `fix-<n>.md` logs are ONE concept each** despite ≥8 H2 sections; the working-log format is intentional. Don't split by H2.
- **DANGLING-LINKs in MEMORY.md/active-fixlog.md resolve in the sibling `.claude` store** (partial-overlap two-store hazard). Never `cp`/sync across mounts to "fix" them.

The one clean, safe win: `index-fix.md`/`index-technique.md` are **stale generated monoliths** left behind by `reindex.sh` (it writes `index-<fam>.md` then shards to `index-<fam>-N.md` but only rm's the shards). The loaded `index.md` links only the shards, so deleting the monoliths is safe (−56KB) — but a full `reindex.sh` run regrows them, so the durable fix is teaching reindex.sh to delete the monolith after sharding.
