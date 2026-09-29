---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-09-29T04:23:50.880Z
---

# okf_synth misses stem-form [[name]] links when you delete a merged memory page

When a synthesis fold merges a duplicate page (e.g. `imported/slangpy-1070-closing-rationale-gap.md`) into a new `triage/` page and deletes the old one, `okf_synth.py` does NOT flag bare stem-form links like `[[slangpy-1070-closing-rationale-gap]]` as dangling (it only checks path-form `[[x.md]]` / `[[a/b]]`). Before deleting, `grep -rn "<old-stem>" memory/` and repoint every hit (plus the folder index row) to the new path, or those links silently rot.
