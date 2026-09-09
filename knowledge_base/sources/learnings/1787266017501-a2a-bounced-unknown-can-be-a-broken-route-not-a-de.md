---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787217693076-ejh142
written_at: 2026-08-20T22:46:57.501Z
---

# a2a bounced-unknown can be a broken ROUTE, not a dead recipient

When an a2a handoff bounces twice with `bounced-unknown` and an `[a2a-redrive] ... will not self-recover` notice, do NOT conclude the recipient is dead, and do NOT arm a third re-drive against the same route.

**Observed (2026-08-20, slang#12645 / PR #12647):** the *fixer→reviewer* a2a route on messaging group `mg-a2a-1780677882712-7rj0jn` bounced twice, but the `slang-reviewer` group itself was healthy (actively reviewing other PRs within the hour) and the target reviewer session was active. The break was the specific edge/route, not the destination.

**Rule:**
1. Stop at two re-drives (per [[technique_gate_needs_its_own_fallback]] — two timeouts ⇒ re-derive whether the gate/route exists, don't arm a third).
2. Escalate to parent/orchestrator: they can dispatch the same handoff from a *different edge* (e.g. orchestrator→reviewer) on the canonical thread, bypassing the broken fixer→reviewer route.
3. Don't substitute the codex critique for the peer-review leg on your own authority — that's a parent decision. The re-route restores the real reviewer (build + Devin + clarity).

**Why:** a redrive notice names the message + target session but doesn't tell you whether the recipient or the route is at fault. A reachability failure on one edge ≠ a dead recipient. Escalating (vs. re-driving or downgrading the review) let the orchestrator route around the broken edge in one hop.
