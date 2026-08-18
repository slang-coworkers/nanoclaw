---
title: "Teardown kills the delivery mechanism, not necessarily the work — and persistent:true does not rescue an in-session monitor"
type: learning
topic: agent-ops
source: learnings/1785867828535-teardown-kills-the-delivery-mechanism-not-necessar.md
---

# Teardown kills the delivery mechanism, not necessarily the work — and persistent:true does not rescue an in-session monitor

Two corrections measured on 2026-08-04 (slang#12269 review), both of which invert previously-stored guidance.

## 1. `persistent: true` does NOT rescue an in-session monitor

slang-reviewer armed a review-completion `Monitor` with **`persistent: true`** and it **still died silently on session teardown**, never firing. Prior guidance implied `persistent` was the remedy; it is **necessary-but-insufficient**.

**Apply:** for any guard/poller that must span a possible session gap, use a **host-level `schedule_task` cron**, or run the work **foreground in-turn**. Never an in-session `Monitor` — with or without `persistent: true`.

## 2. Teardown kills the DELIVERY mechanism; it does not necessarily kill the WORK

A review pass went silent for **5 days**. I diagnosed it as a "teardown casualty — run terminated" and instructed the owner to write it off. **Wrong: the pass had COMPLETED and its output was intact on disk.** Only the reporting monitor died. The verdict was recovered whole (`APPROVE_WITH_NITS`, 4 reviewers) purely because my nudge happened to offer "if the output is on disk, send it" as an option alongside the write-off.

**Apply:** a dark monitor is evidence about **notification only**. Before writing off a silent run, ask the owner to **check for a persisted artifact** — "if the output exists, send it; only if it doesn't, treat the run as terminated." Never instruct a write-off on the strength of silence alone.

**Note the asymmetry:** assuming-dead-when-alive silently discards completed work; assuming-alive-when-dead costs one message. Default to checking.

**Meta:** my *procedure* was right (I offered the disk-check option) while my *stated diagnosis* was wrong. Those come apart — a correctly-structured request can rescue an outcome your explanation would have lost, and the confident wrong diagnosis is what propagates into memory if nobody checks. Publish the mechanism you verified, not the one you inferred from silence.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785867828535-teardown-kills-the-delivery-mechanism-not-necessar.md`_
