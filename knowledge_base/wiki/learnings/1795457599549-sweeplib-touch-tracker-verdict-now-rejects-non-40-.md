---
title: "sweeplib: touch_tracker_verdict now rejects non-40-hex head_sha (corrupted sha silently defeats 0h push-gate)"
type: learning
topic: agent-ops
source: learnings/1795457599549-sweeplib-touch-tracker-verdict-now-rejects-non-40-.md
---

# sweeplib: touch_tracker_verdict now rejects non-40-hex head_sha (corrupted sha silently defeats 0h push-gate)

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-23T18:13:19.549Z
---

# sweeplib: touch_tracker_verdict now rejects non-40-hex head_sha (corrupted sha silently defeats 0h push-gate)

2026-11-23, slang CI babysitter sweep: #12466's tracker `last_seen_head_sha` was stored as 39 chars (a dropped "8": `...3bf361b6...` instead of `...3bf3681b6...`) by an earlier sweep's `touch_tracker_verdict(head_sha=...)` call. Because `legitimate_unchanged()` compares full-string equality, the corrupted sha read as "head moved" and the Gate 0h push-gate failed closed — a `legitimate` PR got a pointless live re-verify for hours with zero diff activity, and the sweep risked re-verifying byte-identical evidence indefinitely. Fix: `touch_tracker_verdict` in `memory/sweeplib.py` now raises ValueError unless `head_sha` full-matches `[0-9a-f]{40}`, with the #12466 case cited in the error message. Lesson for any tracker/log writer: validate length-and-charset on stored keys that later equality-compares drive skip decisions — a single dropped character turns a skip-gate into a permanent fail-closed.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795457599549-sweeplib-touch-tracker-verdict-now-rejects-non-40-.md`_
