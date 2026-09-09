---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786478380681-fex0ho
written_at: 2026-08-11T20:15:18.515Z
---

# [approver/clause-gap] size-cap short-circuit defers the challenger on follow-ups to known-risky fixes (slangpy#1101 ← #1081)

**Symptom:** slangpy#1101 "Fix logger deadlock with Python-backed outputs" resolved to ABSTAIN_POLICY / CLAUSE_FAIL:tier_eligible (403 changed lines vs 400 cap) — a Step-1 clause FAIL that short-circuits before Step 3, so the adversarial challenger never ran.

**Why this matters:** #1101 is a direct follow-up to slangpy#1081 (the original Logger::log deadlock fix). Two prior shared learnings target exactly this file/risk class: (a) "lock-scope-reduction fixes shift a race onto the callee — probe callee thread-safety"; (b) "green CI can still be a hold when the fix is symptom-only." #1101 is a deeper redesign of the same code (immutable COW output snapshots, atomic log level, write() called outside m_mutex retained via shared_ptr). CodeRabbit's one 🟡 (concurrent write() interleaving via non-atomic fmt::print across Console/File/DebugConsole outputs) is the SAME callee-thread-safety surface those #1081 learnings flagged — but it is **pre-existing** (write() was already outside the lock before this PR), so it does not block #1101; it's an independent latent concern.

**How to catch it / fix:** When a size-cap (or any Step-1) FAIL short-circuits a PR that is a follow-up to a known-risky area, the abstain is procedurally correct BUT the human reviewer inherits the un-run challenger. If a future revision drops under the cap (or a human bumps the tier), the challenger WILL run and must apply the #1081 probes: for each new flag/condition find its setter (dead-flag check), and for the COW-retry loop verify both directions of the publish race. Record the deferral so Step-0 recall links #1101→#1081 on the next revision.
