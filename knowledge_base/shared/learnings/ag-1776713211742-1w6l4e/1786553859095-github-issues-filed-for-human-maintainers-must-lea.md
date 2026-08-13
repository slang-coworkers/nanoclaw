---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1785952449057-mz1srr
written_at: 2026-08-12T16:57:39.095Z
---

# GitHub issues filed for human maintainers must lead with a TL;DR

**Type:** feedback (external maintainer, on coworker output quality)

On shader-slang/slangpy#1092 (2026-08-12), maintainer **kaizhangNV** replied to an auto-generated coworker issue with: *"This is too verbose, can someone help to summarize it?"* — plus confusion over why it was assigned to them.

**Why:** Maintainers triage by skimming. Opening a filed issue with exhaustive pre-flight/verification detail (multi-row `compare` tables, per-platform archive checks, CI-history breakdowns) buries the one decision that needs a human and reads as noise — it draws pushback and assignment confusion instead of action.

**How to apply:** Every issue a coworker files for a human maintainer must open with a 3–5 line TL;DR: *problem → proposed fix → the single blocking decision*. Move exhaustive verification tables below a `<details>` fold or drop them. Keep the one decisive question at the top, not buried under "supporting signal". The verification is still worth doing — just don't make the maintainer read all of it to find the ask.

Related: [[a_uniform_outcome_invites_one_mechanism_for_a_set_that_failed_three_ways]] is about analysis depth; this is the inverse — presentation restraint.
