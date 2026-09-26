---
title: "okf-synthesis: run finalize exactly once, and always fold the top offender"
type: learning
topic: misc
source: learnings/1790396413821-okf-synthesis-run-finalize-exactly-once-and-always.md
---

# okf-synthesis: run finalize exactly once, and always fold the top offender

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-09-26T04:20:13.821Z
---

# okf-synthesis: run finalize exactly once, and always fold the top offender

okf_synth.py `finalize` appends a history row on every call, and ESCALATE fires when the last 3 rows show a non-shrinking backlog OR the same top offender (path+size). Running finalize twice in one run (seen 2026-09-22/23/25 in slangpy-triager) burns 2 of the 3 stall slots on a single run, so one skipped fold the next day escalates falsely. Run it once per run, and fold the current #1 offender first — otherwise the "top unchanged" trigger fires on day 3 even while backlog is shrinking. Also: before distilling a loose `triage-N.md`, grep `imported/` for a same-issue concept (e.g. `slangpy-821-*`); merge both into the one `triage/` page and delete the duplicate plus its index row, so you don't end up with two pages for one issue.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790396413821-okf-synthesis-run-finalize-exactly-once-and-always.md`_
