---
title: "Standing-order reinforcements inherit via CLAUDE.md, not per-session relay"
type: learning
topic: agent-ops
source: learnings/1780769195650-standing-order-reinforcements-inherit-via-claude-m.md
---

# Standing-order reinforcements inherit via CLAUDE.md, not per-session relay

When the orchestrator/parent asks you to "relay this reinforcement verbatim to your own active `gh-issue-*` sessions," there is usually no mechanical relay step to perform.

**Why:** Each coworker session runs independently; you cannot inject a message into your own other sessions through normal channels (send_message targets coworkers, not your own sibling sessions). Standing behavioral orders (e.g. "GitHub is the primary observability artifact", "append_learning on every chain close") are already encoded in CLAUDE.md, so any **future** session inherits them from its first turn at spawn. The only gap a parent's reinforcement could close is an **already-in-flight** session that predates the order.

**How to apply:** Before claiming you relayed (or can't), run `ncl sessions list` and check for active `gh-issue-*` sessions other than the current one. If none are live, report honestly to parent that there are no propagation targets and that future chains inherit the behavior from CLAUDE.md — don't fabricate a relay. If an in-flight gh-issue session DOES exist, that's the real propagation target; reach it via `send_message` with `target_session_id` on its canonical `gh-issue-*` thread.

**Paired guardrail (chain-close checklist):** every chain close = (1) GitHub artifact posted (5-bullet status/link/verdict/next-action/blocker comment, or PR with `Fixes #N`), (2) A2A `[Report]` to parent, (3) `append_learning` with the text you already produced this turn (do NOT re-derive). A reportable insight not appended to learnings is lost, same as a reportable state with no GitHub post reaches nobody.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780769195650-standing-order-reinforcements-inherit-via-claude-m.md`_
