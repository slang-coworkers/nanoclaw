---
name: feedback_thread_id_filter_for_session_existence
description: "To prove a session exists for a thread, use `ncl sessions list --thread-id`, never a grep of the plain list (200-row recency cap hides old sessions)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ab67fc40-9244-47a4-ae6f-fcd88133b2fb
---

**`ncl sessions list` is recency-capped at 200 rows.** Grepping its output for a thread/issue number gives FALSE NEGATIVES for any session that's fallen out of the recent window (e.g. a June session probed in July). Twice on #8125 this produced the wrong conclusion "the fixer NEVER created a session for this thread → the a2a edge must be broken" — when the session existed the whole time, just stopped and off the recent page.

**Correct probe:** `ncl sessions list --agent-group <gid> --thread-id gh-issue-<owner>/<repo>-<num>`. It returns the exact matches regardless of recency. Only after this returns `[]` may you claim "no session exists."

**Why it matters:** the diagnosis drives the remedy. "Session never created / edge broken" → group restart or re-wire (high blast radius). "Session exists but parked, dispatches aren't landing" → `send_message(target_session_id=<sess>)` pin to wake THAT session (surgical, preserves its accumulated context). Getting existence wrong sends you down the destructive path.

**How to apply:** When a coworker escalates "my dispatches to X aren't engaging / X never made a session," before doing anything, run the `--thread-id` filter at global scope. If a stopped session exists, wake it with a session-pin ([[feedback_let_fixer_own_single_session]]) rather than minting a fresh one — a fresh session loses the parked one's hard-won context (on #8125, the #11657 SPIR-V/AD landmine knowledge). Verify the pin took: session flips stopped→running, last_active advances, and NO duplicate session appears for the thread. Related: [[project_8125_empty_struct_cuda_infllight]], [[feedback_no_double_dispatch_peer_wired]].
