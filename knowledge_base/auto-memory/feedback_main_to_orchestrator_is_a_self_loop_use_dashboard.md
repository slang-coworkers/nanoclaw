---
name: feedback-main-to-orchestrator-is-a-self-loop-use-dashboard
description: "For Main/Orchestrator, the `orchestrator` agent destination resolves to Main's OWN group id — <message to=orchestrator> is a self-loop that a2a-routes to a dead null-thread catch-all session and bounces silently. 'Up' for a top-of-chain role is the dashboard CHANNEL destination, not the agent destination sharing its name."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 62aa630d-2cf2-4171-b501-95bd015c1719
---

**2026-08-27/28 — I sent the #12200 operator escalation `to="orchestrator"` TWICE; both bounced,
NOT delivered, and I did not notice until the second `[a2a-redrive]` notification.**

## The mechanism

`ncl destinations list` for my group shows two rows that look interchangeable but are not:

```
ag-1776713211742-1w6l4e  orchestrator            agent    ag-1776713211742-1w6l4e   ← MY OWN group id
ag-1776713211742-1w6l4e  orchestrator-dashboard  channel  mg-1776713211742-om8syu   ← the operator's dashboard
```

- `orchestrator` is an **agent** destination whose target `ag-1776713211742-1w6l4e` **is my own group.**
  So `<message to="orchestrator">` is a **self-loop** — it a2a-routes back into my own group. My CLAUDE.md
  spine states this verbatim: *"Never use your own group name as a `<message>` destination — it loops
  back as a2a delegation, creating a duplicate bubble."* The destination is *named* "orchestrator" but it
  points at me.
- Routing resolves that self-a2a to my group's **legacy shared session** `sess-1778753685788-qi4a4m`
  (`messaging_group_id: mg-a2a-1778753685786-bl63x9`, **`thread_id: null`**, created 2026-05-14,
  `container_status: stopped`). A null-thread catch-all is sticky: with no per-thread key, routing keeps
  resolving to that ONE session every time.
- That session's container won't respawn on the redrive (bounced `bounced-unknown`, 2× transient/unknown
  provider error), so **every** send to `orchestrator` lands there and bounces. A third identical re-drive
  bounces identically — re-driving the same way is not "chasing a dark recipient," it is re-triggering a
  deterministic failure.

## How to apply

- ⭐⭐⭐**Main has NO parent. "Report up" for a top-of-chain role = deliver to the operator via the
  CHANNEL adapter, which is `orchestrator-dashboard` (`mg-1776713211742-om8syu`), NOT the `orchestrator`
  agent destination that shares the name.** The spine already says this ("a top-of-chain role with no
  parent reads 'up' as delivery to the user via the channel adapter, not a `to=parent` edge") — I had the
  rule and still reached for the agent destination because its name matched the concept.
- ⭐⭐**A `[a2a-redrive] ... bounced 2× ... NOT delivered` notification naming a target `agent_group_id`
  equal to MY OWN group is the tell: I sent to myself.** Decode the `Original message` id timestamp
  (`a2a-<ms>-…`, ms since epoch) to confirm it's my own recent send before treating it as someone else's
  handoff to re-drive.
- ⭐⭐**Never re-drive a bounce by re-sending to the same destination that produced it** — establish WHY
  it bounced first (`ncl destinations list`, `ncl sessions get <target-sid>`). Here the fix was a
  different delivery surface, not a retry.
- Cf. spine "Never use your own group name as a `<message>` destination"; [[feedback_bare_text_is_delivered]]
  (a delivered-but-wrong-surface message is still a real send); ANCHOR H (phantom sessions from
  mis-resolved routing).
