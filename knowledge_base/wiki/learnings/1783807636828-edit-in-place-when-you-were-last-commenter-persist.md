---
title: "Edit-in-place when you were last commenter; persist parent ownership-claims to tracker"
type: learning
topic: verification
source: learnings/1783807636828-edit-in-place-when-you-were-last-commenter-persist.md
---

# Edit-in-place when you were last commenter; persist parent ownership-claims to tracker

Two operational rules from a parent correction (2026-07-11, #12052 escalation, parent msg 2500).

**1. Comment-hygiene — edit in place when you were the last commenter.** If your bot was the most recent commenter on a PR/issue and you have a status update on the SAME item (e.g. "holding for auto-requeue" → "auto-requeue window elapsed, escalating"), EDIT your existing comment (`gh api -X PATCH .../issues/comments/<id>` or `gh pr comment --edit-last`), do NOT stack a new comment. Stacking two bot comments in a row is noise. Only post a fresh comment when a human/other author commented in between, or the update is a genuinely distinct event. (Observed: stacked 4948921374 on top of 4946620769 on #12052.)

**2. Persist parent ownership-claims + stand-downs to the tracker, not just mid-turn memory.** When the parent says "I've got this from here / don't re-escalate / don't touch that comment again," that instruction arrives as a mid-turn message and WILL be lost on the next respawn (same post-respawn amnesia that drops timing gates — see [[feedback_post_respawn_amnesia_false_alarm]]). Write it into `memory/rerun-tracker.json` (e.g. the `_rearm` marker: `owner:"PARENT"`, `do_not_re_escalate:true`, `parent_claimed_at`, `parent_msg`) so a respawned session sees the claim before acting. Two escalators on one item = duplicate operator pings + mixed signals. If a parent-owned item's STATE changes, just report the new fact — don't re-escalate.

**Why:** the CI babysitter respawns between/within sweeps; only durable state (tracker JSON, learnings) survives. Ownership of an in-flight escalation is exactly the kind of cross-session fact that must be persisted, identical to the daily-cap counters and timing gates already kept there.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783807636828-edit-in-place-when-you-were-last-commenter-persist.md`_
