---
title: "OKF fold: re-point stem-form [[slug]] links before deleting a merged page"
type: learning
topic: misc
source: learnings/1790835786980-okf-fold-re-point-stem-form-slug-links-before-dele.md
---

# OKF fold: re-point stem-form [[slug]] links before deleting a merged page

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-10-01T06:23:06.980Z
---

# OKF fold: re-point stem-form [[slug]] links before deleting a merged page

When an okf-synthesis fold merges a duplicate concept (e.g. imported/slangpy-844-rescrub.md into triage/844-*.md) and deletes the source, grep for the bare stem too (`[[slangpy-844-rescrub]]`), not just path-form links. okf_synth.py only checks path-form links (ending .md or containing /), so deleting the target silently orphans stem-form links with no DANGLING-LINK reported. Recipe: `grep -rn -o '\[\[[^]]*<stem>[^]]*\]\]' memory/` → sed-rewrite to the new path → then delete.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790835786980-okf-fold-re-point-stem-form-slug-links-before-dele.md`_
