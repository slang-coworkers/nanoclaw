---
name: project_slang_fixer_auth_outage
description: RECOVERED ~07:06Z 07-15 — slang-fixer auth down 07-14; picked up queued #12097 handoff on recovery
metadata: 
  node_type: memory
  type: project
  originSessionId: 0c896180-ff45-4841-97a8-b1e68087b6b1
---

**✅ RECOVERED ~07:06Z Jul 15.** slang-fixer auth is back and actively working #12097 (worktree `fix/issue-12097`, Approach A implemented, build in progress, GPU L40S present for spirv-val NV+EXT). It picked up the QUEUED handoff on recovery — the pending inbound survived; the fix is now in progress WITHOUT a re-send. **⚠ Told slang-triager NOT to re-send the handoff** — its standing plan was to fresh re-send on my confirm-ping, but that would now be a double-dispatch → duplicate worktree/PR. Triager redirected to hold for the [Fix Report]. Below = 07-14 outage record, kept for pattern.

---

**07-14: slang-fixer container is unauthenticated.** A handoff from slang-triager (for #12097) bounced with the literal reply "Not logged in · Please run /login". Same class as the ~07-10+ AWS/Bedrock provider-auth outages. This is the FIXER — distinct container from the triager (the triager's own 07-13 outage per [[project_slang_triager_auth_outage]] appears RECOVERED: it completed the full #12097 triage 07-14, so that note is likely stale). Not fleet-wide right now — triager works, fixer doesn't → per-container auth state.

**Fix = OPERATOR re-login, NOT container restart.** Restart orphans the queued handoff session and does not fix auth (see [[feedback_benign_ack_loop_dont_restart_if_live_chains]]). Do NOT re-send to the down session (thrash). The triager already queued the handoff+memo on canonical thread `gh-issue-shader-slang/slang-12097`; the fixer picks it up on recovery.

**Escalated to operator 07-14** via orchestrator-dashboard + PushNotification. On recovery: let the fixer consume the queued #12097 memo (approach A, draft PR, `Closes #12097`); then ping slang-triager to forward the [Fix Report] upstream. Any OTHER chains queued to the fixer are likewise stalled until re-auth — re-check active fixer sessions on recovery.

Chain #12097 remains OPEN, held on fixer recovery. See [[project_12097_ser_spirv14_vs_12099]].
