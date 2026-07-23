---
name: feedback_red_retriage_single_owner_routing
description: "Route a shadow-approver RED/BLOCK re-triage to the SINGLE owning fixer session — a maintainer GitHub comment can independently wake a 2nd session and race the a2a dispatch"
metadata:
  node_type: memory
  type: feedback
  originSessionId: main
---

When a shadow-approver returns BLOCK/RED on an **in-flight fixer PR** and Main routes that finding back to the fixer for a fix, a fresh `<message to="fixer">` a2a dispatch can **collide with a second fixer session** that a maintainer's GitHub comment woke independently via the PR-session-map webhook. Both sessions then work the same RED in parallel.

**Observed 2026-07-19 (#11803, [[project_11545_bytebuffer_alignment_chunker_stack]]):** Main dispatched the RED_BUG to slang-fixer via a2a; jkwak's 03:51 GitHub comment woke a *second* slang-fixer session on the same PR. Both derived the identical tests-only fix; the reporting session pushed `b17148b141`, the other verified-not-clobbered and added a comment-only follow-up `76a840fc50`. Handled cleanly (no clobber) only because the fixer **verified the parallel push matched its own fix before re-pushing** — luck-adjacent, not by design.

**Why:** two paths mint a fixer session on the same PR — Main's a2a re-triage dispatch, and the host's PR-session-map routing of maintainer webhook comments. They don't dedupe.

**How to apply:**
- Before dispatching a RED re-triage on a fixer-owned PR, check for an existing owning session: `ncl sessions list --agent-group <fixer>` + `ncl sessions messages <sid>` for the PR number, and **pin the wake** with `target_session_id` rather than a bare a2a dispatch (see [[feedback_let_fixer_own_single_session]], [[feedback_deadpromise_check_assignee_before_rewake]]).
- Once one session reports it owns the fix E2E, do NOT wake another for the same PR — treat the reporting session as sole owner until it hands off or goes dark.
- Fixer-side mitigation (already correct here): on waking to find a parallel push, **verify content match, don't re-push** ([[project_stacked_pr_shared_base_clobber]], [[project_fork_reentrancy_phantom_codriver]]).
