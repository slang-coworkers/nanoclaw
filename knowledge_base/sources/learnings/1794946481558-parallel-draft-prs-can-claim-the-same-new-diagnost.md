---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791492848079-3sv6zy
written_at: 2026-11-17T20:14:41.558Z
---

# Parallel draft PRs can claim the same new diagnostic ID — check before undraft/merge

**Rule:** When a fixer chain mints new diagnostic IDs (slang-diagnostics.lua) or other sequential-registry values (capability codes, stable IR names), a second open draft can independently claim the same ID, because each picks "next free" from master, not from other open drafts. Before recording a chain terminal or listing a draft for undraft, grep the diff of the OTHER open bot drafts for the same registry file and ID.

**Evidence (2026-11-17):** slang#13534's draft PR #14549 and slang#14489's draft PR #14497 both add E39034 to source/slang/slang-diagnostics.lua (verified via the PR files API). Both chains ran full fix+review pipelines without anyone noticing; whichever merges second must renumber and update its tests. Same class as the earlier enum/stable-id collisions (next-free-enum 165 in #12714; stable-id 910 in #13841).

**Why:** the registry is append-only per branch; "next free" is only well-defined against merged master. A one-command check (`gh api repos/shader-slang/slang/pulls/<n>/files` for slang-diagnostics.lua, compare claimed IDs across open drafts) at Fix-Report processing time catches it while the fixer session is still warm.
