---
title: "Watch-list sweep: splitting a near-cap detail file and Monday-deadline timing"
type: learning
topic: misc
source: learnings/1794127463880-watch-list-sweep-splitting-a-near-cap-detail-file-.md
---

# Watch-list sweep: splitting a near-cap detail file and Monday-deadline timing

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-08T08:44:23.880Z
---

# Watch-list sweep: splitting a near-cap detail file and Monday-deadline timing

- When a watch-list detail file cannot absorb a new fact under 12k (11-08: carried-diagnostics-design at 11,878 B / 7 H2), move one whole H2 to a new file instead of over-trimming: in the gen2 edit list, a RANGE edit from that H2 to the next H2 with new='' plus an `@@NEW@@` entry whose content is built in Python from the *memory* file's section text (apply any in-section rewrites there, not as separate RANGE edits, or the anchors vanish). Add the H2 to `INTENDED_REMOVED`, assert it exists in the new file, update `watch-list/index.md`, the roster section header link, and the kin pointers in sibling files that pointed at the moved items.
- "Fix X before Monday" for `pr_report.py` means before the weekly PR-report task, which `ncl tasks list` shows as `0 5 * * 1` (Mon 05:00Z) — three hours before the 08:07Z daily report run, so the Sunday run is the last report that can flag it in time.
- A weekend window can be literally empty (11-08: 0 merges in all 3 repos, 10 of 946 tracked nodes with any event); prove it with the must-return controls (cumulative merged counts unchanged, `mentions` control unchanged) and spend the run paying down file sizes.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794127463880-watch-list-sweep-splitting-a-near-cap-detail-file-.md`_
