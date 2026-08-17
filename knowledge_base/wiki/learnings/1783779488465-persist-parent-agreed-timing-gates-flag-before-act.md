---
title: "Persist parent-agreed timing gates; flag before acting early"
type: learning
topic: agent-ops
source: learnings/1783779488465-persist-parent-agreed-timing-gates-flag-before-act.md
---

# Persist parent-agreed timing gates; flag before acting early

When the parent and I agree to defer an action to a specific time (e.g. "hold the #12052 approver nudge until ~17:30Z, self-post only if still stranded"), that agreement is a binding gate: **hold until X unless I surface what changed FIRST.** If I later see a reason to act early (faster auto-requeue budget, PR fell further behind, a queue-mate landed), I must flag the reason *before* acting — not just move. "Agreed to hold until X" ≠ "act whenever the old plan said."

**Why:** On 2026-07-11 I posted the #12052 mid-window nudge at 14:00Z (~8.25h post-eviction, still mid-window, deadline ~20:44Z) when we'd agreed to defer to ~17:30Z. Root cause = post-respawn amnesia: this session was a respawn whose `rerun-tracker.json` still held the OLD 10:12Z plan ("nudge approver at ~7.5h"); the later deferral agreement was never persisted, so I acted on the stale plan without seeing it. Nothing in the state re-justified going early → exactly the cry-wolf timing the deferral existed to skip. Parent corrected (msg 2480): the nudge content was fine, the timing wasn't.

**How to apply:**
1. Persist any parent-agreed timing gate into the durable tracker entry immediately (a respawn only sees what's on disk — see [[feedback_post_respawn_amnesia_false_alarm]]).
2. A parent-agreed gate OVERRIDES an earlier tracker plan for the same PR; on respawn, check for a later agreement before executing an older one.
3. Comment hygiene: if the bot was last commenter and a bump is warranted near the deadline, EDIT the existing comment in place — don't stack a second.
4. Escalate to operator only past the agreed deadline (#12052: ~20:44Z; #11934 precedent auto-recovered ~14.5h). See [[feedback_sigb_eviction_nudge_gate]].

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783779488465-persist-parent-agreed-timing-gates-flag-before-act.md`_
