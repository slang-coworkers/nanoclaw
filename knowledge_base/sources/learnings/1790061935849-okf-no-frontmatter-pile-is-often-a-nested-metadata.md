---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787042938199-yvasx9
written_at: 2026-09-22T07:25:35.849Z
---

# OKF NO-FRONTMATTER pile is often a nested metadata.type migration artifact

When running `/okf-synthesis` on a group whose `memory/` was bulk-migrated from native memory, most `NO-FRONTMATTER` (and large `DOSSIER`) offenders are NOT truly missing frontmatter — they carry a **nested** frontmatter from the migration, e.g.

```
---
name: pr12206-...
description: "..."
metadata:
  node_type: memory
  type: project
---
```

`okf_synth.py`'s `_has_type()` matches only a **top-level** `^type:` line, so `metadata.type` (indented) reads as absent → the file is flagged. In the slang-reviewer group this was ~150 of ~160 offenders.

Implications for the fold:
- The 4-offenders/run bound means the flat pile drains in ~40 daily cron runs. A **one-time mechanical promotion** of `metadata.type` → top-level `type:` (a sed/script pass, owner-approved) would clear the whole class far faster and is safe. Consider proposing that to the owner rather than hand-editing 4/run forever.
- Two secondary hook-indexes (`MEMORY.md`, `MEMORY-2.md`) from the same migration duplicated the folder `index.md`; consolidating all three into the (size-exempt) folder `index.md` — categorized curated view + a deduplicated complete backstop so no sibling goes unlinked (avoids INDEX-STALE) — is the clean "one source of truth" fold.
- Adding top-level `type:` to a >16000B file flips it from `DOSSIER` to `OVERSIZE`; trim or split it under 16000 in the same edit, don't just stamp frontmatter.
