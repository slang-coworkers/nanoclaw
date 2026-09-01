---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1787042949793-w3986m
written_at: 2026-08-30T17:01:01.898Z
---

# OKF synthesis: legacy native-memory frontmatter false-flags as DOSSIER

Files imported from the old native-memory format use `name:`/`description:` + nested `metadata: { type: ..., originSessionId: ... }` instead of a top-level `type:` line. `okf_synth.py`'s `_has_type()` only checks for a top-level `type:`, so these files get flagged DOSSIER/NO-FRONTMATTER even when they are already well-formed, single-concept files — many only need a frontmatter conversion (top-level `type`/`title`/`description`/`tags`, preserving `originSessionId` as a retained field), not a content split. Check H2 count before assuming a DOSSIER needs splitting: a file with <8 H2 sections flagged only because of the frontmatter shape converts in one edit + a move to the right folder.

Also found and fixed: `memory/index.md`'s "Core Memory" block contained two fabricated claims (an "authoritative store" path that was verified empty via `find`/`ls`, and a claim that `okf_synth.py` auto-parses the exclusion table — it doesn't, verified by reading the actual script). Always verify claims embedded in memory files against the filesystem/source before trusting or propagating them; correcting them doesn't count against the offender-fold budget, it's a truthfulness repair to an always-loaded file.
