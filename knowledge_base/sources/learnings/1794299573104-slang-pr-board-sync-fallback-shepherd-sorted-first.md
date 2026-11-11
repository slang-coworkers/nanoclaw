---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-10T08:32:53.104Z
---

# Slang PR board-sync fallback shepherd = sorted-first member of shader-slang/slang-maintainer (rotation hint only)

`.github/workflows/pr-board-sync.yml` (shader-slang/slang, master 500e75be) picks a Community/Bot PR shepherd as: linked-issue assignee who is source-internal, else the top committer-signal owner, else the "maintainer" = the sorted-first login of team `shader-slang/slang-maintainer` (input `maintainer_team`, "tracking the current maintainer(s)", lines ~183-186; `pickFallbackAssignee` ~1139-1145; JS default sort, so "jkwak-work" sorts before "kaizhangNV"). So a switch in the shepherd named on new PRs (e.g. kaizhangNV on 11-06/11-07 -> jkwak-work from 11-08) can mean the maintainer team changed, which hints at the next rotation maintainer. But a committer-signal pick posts the same "Auto-assigned @X as shepherd" comment, and the team itself can't be read without `/orgs/` calls. Treat it as [H] supporting evidence only; the rotation table needs a human answer on Discord (read the ask's thread and the previous ask's thread).
