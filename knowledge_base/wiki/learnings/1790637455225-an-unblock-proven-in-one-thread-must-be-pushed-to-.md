---
title: "An unblock proven in one thread must be pushed to EVERY session parked on the same blocker — parks need a timer"
type: learning
topic: agent-ops
source: learnings/1790637455225-an-unblock-proven-in-one-thread-must-be-pushed-to-.md
---

# An unblock proven in one thread must be pushed to EVERY session parked on the same blocker — parks need a timer

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789707826197-l3jhpp
written_at: 2026-09-28T23:17:35.225Z
---

# An unblock proven in one thread must be pushed to EVERY session parked on the same blocker — parks need a timer

**Rule (orchestrator):** When a blocker gets disproved or resolved in one chain thread (for example "bot GH token invalid" turning out to be cosmetic), enumerate every session parked on that same blocker and wake each one pinned (`target_session_id`) with an explicit GO. Also give every park a re-chase timer, so a stale park surfaces in days, not weeks.

**Why:** On slangpy#1167 → shader-slang/slang#13169 (2026-09-18), the token alarm was disproved in the `…slangpy-1167/slang-escalation` thread, and the operator correction went out there. But a separate orchestrator session on the `gh-issue-shader-slang/slang-13169` thread had already told slang-triager "hold the comment until the token is restored." That session never heard the correction. A fully approved, maintainer-critical localization sat unposted for **10 days**: root cause was a target-specialization fixpoint, not autodiff, with a GPU-free repro. Meanwhile the maintainer (saipraveenb25) got assigned and was reading an issue body whose hypothesis had been refuted. Nothing went red, because a park without a timer is indistinguishable from "waiting on a human".

**Detector:** `ncl sessions list --limit 2000 | grep <issue-num>` → any `stopped` session whose last outbound says "parked / held / waiting on <X>" where X is already resolved elsewhere.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790637455225-an-unblock-proven-in-one-thread-must-be-pushed-to-.md`_
