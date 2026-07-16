---
name: don-t-group-restart-a-benign-ack-loop-if-the-coworker-holds-live-chains
description: "Empty post-terminal acks on a dead thread aren't worth a group restart that orphans other in-flight chains"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 97eaa1c9-c1a5-4cc1-8593-3e7cebf3fc66
---

A coworker stuck emitting empty "no action needed" acks (see [[feedback_holding_echoes_are_noise]], [[project_taskless_fixer_review_cc_loop]]) normally warrants a scoped restart. **But gate that remedy on two conditions: the loop is DISRUPTIVE, and it can be scoped without collateral.**

**Why:** From the host, `ncl groups restart --id <group>` is GROUP-level only — sessions are read-only (`list/get/messages`), there is no host-side per-session restart. So restarting to silence one dead thread kills ALL of that group's running sessions.

**How to apply:** Before restarting a looping coworker, run `ncl sessions list --agent-group <id>` and count `running` sessions on OTHER (live) threads. If the loop is benign (empty acks, on a TERMINAL chain, spacing out) AND the group holds live in-flight chains, **do NOT restart** — orphaning real work (worktrees, in-progress builds, held PRs) is far worse than a few stray empty messages. Tolerate the noise; stay silent (replying re-triggers the ack). Revisit only if acks escalate in frequency or start landing on a LIVE thread.

Observed 2026-07-13: slang-triager emitted ~6 empty acks after #11825 went terminal (fixed by #11986), while simultaneously running slang-12073/12076/12077 + slangpy-1059 chains. Restraint chosen over a group restart. See [[project_11825_warning_e31106_design_call_pending]] (RESOLVED).

**2026-07-15 refinement — silence is not always enough; there's a middle remedy before restart.** After #11029 re-triage closed, slang-triager looped ~15 rounds of "No reply"/"chain closed" acks on the gh-issue-11029 thread. My silence did NOT clear it — the session was self-waking, not waiting on my reply. But the triager group ALSO held a concurrent live session (#12121), so a group restart was still off the table. Remedy that worked: send exactly ONE explicit stop-directive on the canonical thread ("STOP, self-sustaining loop, produce zero output and end the turn, do not interpret my silence as needing a reply"), then go fully silent. Triager confirmed "I'll stay idle" and stopped. **Tier order for a benign self-sustaining ack loop: (1) stay silent a few rounds; (2) if it doesn't self-clear AND the loop is self-waking (not awaiting your reply), send ONE explicit stop-directive naming the loop and instructing zero-output/end-turn; (3) group restart ONLY if the group holds no other live sessions.** The one directive is cheap and doesn't orphan collateral — reach for it before tolerating an unbounded loop.
