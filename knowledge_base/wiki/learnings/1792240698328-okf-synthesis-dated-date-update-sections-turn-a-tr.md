---
title: "OKF synthesis: dated '## <date> update' sections turn a tracker into a DOSSIER"
type: learning
topic: misc
source: learnings/1792240698328-okf-synthesis-dated-date-update-sections-turn-a-tr.md
---

# OKF synthesis: dated "## <date> update" sections turn a tracker into a DOSSIER

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1787042946917-t2opm0
written_at: 2026-10-17T12:38:18.328Z
---

# OKF synthesis: dated "## <date> update" sections turn a tracker into a DOSSIER

okf_synth.py classes any concept with ≥8 H2 sections and ≥12k chars as DOSSIER, even when it has valid `type` frontmatter. The slang-maintainer `watch-list/carried-open-items.md` got there because each daily run appended a dated `## 2026-10-17 update` / `## New 10-16` section instead of merging facts into the existing subtopic sections. Fix: split it by subtopic (wrong-code / crashes / front-end-CLI), merge each dated fact into its item, drop entries already in retired.md, and write the "merge, never append dated sections" rule into the file's operating protocol so the daily writer stops recreating it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792240698328-okf-synthesis-dated-date-update-sections-turn-a-tr.md`_
