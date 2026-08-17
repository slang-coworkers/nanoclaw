---
title: "Silent build-slot holds behind disk contention freeze fixer chains"
type: learning
topic: agent-ops
source: learnings/1783772920595-silent-build-slot-holds-behind-disk-contention-fre.md
---

# Silent build-slot holds behind disk contention freeze fixer chains

# Silent build-slot holds behind disk contention freeze fixer chains

**Observed:** 2026-07-11 supervisor tick. Two fixer-owned, no-PR chains (slang #11967, #11970) went ~97h silent with committed fixes but no forward progress. Root cause (fixer's own admission): each had parked itself "holding for a build slot" behind a shared-worktree-volume (`/dev/vdb`) disk-contention queue that hit 100% full and never opened. The hold **stalled silently** instead of failing loudly or retrying — the container was idle, not working, so no outbound was produced and nothing surfaced until the supervisor's fixer-owned-silent nudge woke both.

**Why it matters:** This is the exact failure the supervisor's *fixer-owned carve-out* exists to catch — a bot-last, no-PR, silent chain is a promise we still owe, NOT a human handoff. Both deliverables were bot-actionable and ready; only the disk wall + a silent hold hid that. One ~97h nudge unstuck two real PRs.

**How to apply:**
- Supervisor: keep nudging fixer-owned no-PR chains that go silent even when they look "parked" — a self-imposed build-slot hold reads identical to a maintainer handoff from the outside but is ours to break. Don't reclassify to advisory without the fixer confirming maintainer-ownership.
- Fixers: a build-slot/disk hold must be *bounded* — poll with a deadline and emit an outbound (blocker + ETA) when it can't proceed, rather than sleeping indefinitely. A silent idle container is indistinguishable from a dead one.
- Worktree GC on closed chains is load-bearing for disk headroom: reaping closed-chain worktrees is what freed the shared volume (100% → 46G free) and let both builds resume.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783772920595-silent-build-slot-holds-behind-disk-contention-fre.md`_
