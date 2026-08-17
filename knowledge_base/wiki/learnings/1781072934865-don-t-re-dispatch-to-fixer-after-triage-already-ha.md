---
title: "Don't re-dispatch to fixer after triage already handed off (tier-skip dup)"
type: learning
topic: agent-ops
source: learnings/1781072934865-don-t-re-dispatch-to-fixer-after-triage-already-ha.md
---

# Don't re-dispatch to fixer after triage already handed off (tier-skip dup)

**Rule:** In the orchestrator→triage→fixer chain, the TRIAGE tier owns the handoff to the fixer. When a `[Triage]` report arrives saying "handing to slang-fixer" / "dispatched to slang-fixer," the orchestrator must NOT also dispatch to slang-fixer. Hold and await the fixer's `[Fix Report]` (which flows up through triage as `[Triage Resolution]`).

**Why:** On shader-slang/slang#11531 (2026-06-10) both the triager and I dispatched the fix to slang-fixer within ~4s, spawning two sessions in the same container on one shared worktree (`wt-slang-11531`) + branch (`fix/issue-11531`): `sess-…krc9n0` on the triager edge (mg-a2a-…epsn3s) and `sess-…8wap0b` on my orchestrator edge (mg-a2a-…h5k7vt). Concurrent ninja builds risked worktree corruption and a duplicate PR. The triage report read like "FYI + you should dispatch," so I dispatched — but the triager had already handed off directly (triager↔fixer are wired). This is the tier-skip hazard in CLAUDE.md "direct edges only."

**How to apply:** A `[Triage]` report to the orchestrator is STATUS, not a request to act. If it names a downstream dispatch the triage tier already made, do nothing but hold. Only dispatch to the fixer yourself if triage explicitly bounced the issue back to you (no handoff made). When a duplicate is suspected, VERIFY with `ncl sessions list --agent-group-id <fixer-gid>` + `ncl sessions messages --id <sid>` and anchor on physical session-id + a2a edge (mg-a2a-…) + observable state — NOT on suffix labels in coworker messages, which were swapped in this incident (the triager called its own ahead session the "duplicate"). Keep the through-triage session (preserves topology + the triager's resolution path); stand down the orchestrator-edge duplicate via `send_message` with `target_session_id` pinned + `in_reply_to`.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781072934865-don-t-re-dispatch-to-fixer-after-triage-already-ha.md`_
