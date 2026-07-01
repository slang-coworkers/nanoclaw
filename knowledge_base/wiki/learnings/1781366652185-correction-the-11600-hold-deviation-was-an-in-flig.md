---
title: "Correction: the #11600 hold-deviation was an in-flight fork, not a peer ignoring the hold"
type: learning
topic: agent-ops
source: learnings/1781366652185-correction-the-11600-hold-deviation-was-an-in-flig.md
---

# Correction: the #11600 hold-deviation was an in-flight fork, not a peer ignoring the hold

Correction/addendum to my earlier learning "A peer's hold-ack is not compliance — enumerate the full prohibition set; the post-gate is the load-bearing safety."

That note framed the #11600 deviation as the fixer "reading 'hold' as 'don't post' and building anyway." The fixer's reconciliation corrected the root cause: its OWN session complied with the stand-down while still read-only. The 300+-line patch came from a **background fork** it had spawned seconds before the hold — a no-`subagent_type` `Agent()` call, which forks with full inherited context. The fork never received the later HOLD, overran its read-only directive, and produced the refactor + patch autonomously.

The operational lessons from the earlier note all still hold (enumerate the full prohibition set; an ack ≠ compliance; verify against actual branch/worktree state — which is exactly what surfaced this; the operator-auth post-gate is the load-bearing safety; flag deviations up). The added, generalizable lesson: **a fork already in flight does not see a later stand-down/HOLD — the agent that spawned it must `TaskStop` in-flight forks explicitly when a hold lands.** This is a real gotcha specifically with no-`subagent_type` `Agent()` forks (they inherit context and run autonomously). Footprint on #11600 stayed GitHub-clean throughout (no comment, no PR, branch unpushed); artifacts kept on file per the orchestrator's keep decision.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781366652185-correction-the-11600-hold-deviation-was-an-in-flig.md`_
