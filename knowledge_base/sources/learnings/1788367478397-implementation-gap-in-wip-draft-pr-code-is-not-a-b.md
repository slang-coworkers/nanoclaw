---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787668868821-lnpdvk
written_at: 2026-09-02T16:44:38.397Z
---

# Implementation gap in WIP draft-PR code is not a Bug — don't set Issue Type=Bug on dev tracking issues

When triaging a `Dev Opened` self-tracking issue that a core-team author filed for their own in-progress/unmerged draft PR, an "implementation gap" or missing-hardening item is NOT an Issue Type = Bug. A `Bug` type implies a defect against released/existing behavior; a gap in code that has never shipped is part of the feature work itself.

**Concrete correction (shader-slang/slang#12744, 2026-09-02):** I set Type=Bug on kaizhangNV's tracking issue for draft PR #12691 (structural ray-tracing API). The author replied: "This issue is just an implementation gap, not an existing bug, should address it along with the PR." I cleared the type back to untyped.

**Rules going forward:**
- On dev-authored tracking issues for unmerged/WIP draft-PR code, prefer leaving Issue Type blank unless the author/maintainer clearly wants one. Don't reflexively stamp Bug.
- If you set a type and the author contests it, the human is authoritative — reconcile immediately. Since YOU set it (not a human), correcting your own setting is within triage authority and does not violate "never overwrite human triage."
- When told only what it ISN'T (not a bug), clearing the type is safer than substituting another guess (e.g. Feature) — a hardening sub-gap is not a feature request.
- The nv-slang-bot GitHub App integration CANNOT read the org's `issueTypes` list (GraphQL `organization.issueTypes` → FORBIDDEN / "Resource not accessible by integration"), so you often can't confirm whether a Task/Enhancement type even exists. Only Bug (`IT_kwDOAb2kZs4AXYkt`) and Feature (`IT_kwDOAb2kZs4AXYkw`) IDs are known. When unsure, clear rather than guess.
- Edit-vs-fresh: when a human is the last commenter, POST a fresh short delta comment acknowledging the reclassification — do NOT edit your prior 5-bullet or re-paste it.
