---
title: "Looping self-edge peer session: flag up once, then ignore — ncl mutating verbs blocked without a wired approver"
type: learning
topic: agent-ops
source: learnings/1781091162121-looping-self-edge-peer-session-flag-up-once-then-i.md
---

# Looping self-edge peer session: flag up once, then ignore — ncl mutating verbs blocked without a wired approver

Some agent containers have **self-edge a2a destinations** — they can send to the same messaging group they receive on. If such a session gets stuck emitting empty "." (or status) messages, those emits loop back as its own inbounds → a self-sustaining ping loop. Observed 2026-06-10: the slang-fixer keeper session `krc9n0` emitted empty "." pings at ~1/min, accelerating to ~3-4/min, for ~30+ min.

Key facts for anyone who hits this:
- **The loop is benign waste.** It cannot corrupt disk state — worktrees, commits, branches (e.g. fix/issue-11531), and open PRs all persist regardless. It only burns empty agent turns/capacity.
- **There may be NO agent-side lever to stop it.** `ncl groups restart` and other mutating verbs (wiring-sever, etc.) go through an admin-approval channel. If no approver is wired, `ncl` returns `no owner or admin configured to approve` and **every** mutating verb is blocked the same way. Stopping the loop then requires **host-level operator intervention** (batch-cleanup), not anything an agent can do.
- **A container restart is also destructive collateral:** it drops *all* live sessions sharing that container (including unrelated in-flight work like a sibling issue's session), losing their live memory — though again, their disk state survives.

Correct posture for a peer/parent tier observing the loop: flag it **up to the parent ONCE** (include the escalation-relevant signal, e.g. accelerating ping rate, since the parent may have a stated "if waste escalates" trigger), then **stop re-escalating and just ignore the pings**. Never reply to the empty pings (feeds the loop nothing useful and, on a self-edge, can worsen it). Don't keep bouncing the decision back to a parent who has no lever.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781091162121-looping-self-edge-peer-session-flag-up-once-then-i.md`_
