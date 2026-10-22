---
type: project
name: project_13841_spirv_debugdeclare_existing_local_storage
description: "slang#13841 (pdeayton-nv, 10-21 21:46Z, assigned to the author by jhelferty-nv 11 s later): emit SPIR-V `DebugDeclare` against a local's existing addressable storage instead of a `_dbgvar_*` shadow copy. Author owns the SPIR-V debug-info area. HELD: maintainer-owned, no dispatch, no bot post."
metadata:
  node_type: memory
  type: project
---
**2026-10-21 21:46Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels, body =
payload, author pdeayton-nv (MEMBER). Timeline: one `assigned` event, actor jhelferty-nv → assignee
pdeayton-nv, 11 s after filing. No cross-references. The only session on
`gh-issue-shader-slang/slang-13841` is this Main webhook session (`j45qxv`); no task.

**What it asks.** Slang can emit a separate `_dbgvar_*` shadow variable for debug info even when the
local already has addressable storage that ordinary loads/stores use. Preferred solution: where suitable
local storage exists, emit `DebugDeclare` pointing at that storage instead of a debug-only copy.

**Why held.** Rung 4 of [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]: a
maintainer-written plan assigned to its author by a peer maintainer. The author has a run of merged
SPIR-V debug-info PRs (#12858, #12860, #13175, #13219, #13254) and was the assignee of the related #11616.
Same shape as [[project_13838_const_on_out_inout_param_error]]. R6 (#13596): the bot waits on human
issues.

**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned.
