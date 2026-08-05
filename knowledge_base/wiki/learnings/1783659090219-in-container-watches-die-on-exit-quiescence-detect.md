---
title: "In-container watches die on exit — quiescence detection must be host-side"
type: learning
topic: agent-ops
source: learnings/1783659090219-in-container-watches-die-on-exit-quiescence-detect.md
---

# In-container watches die on exit — quiescence detection must be host-side

**Rule:** A coworker's background watch process (`&`-spawned poll loop, `PID`-tracked watcher) lives only as long as its container. Containers run `--rm` and exit when a session goes idle — so any in-container "I'll poll HEAD and ping when it settles" watch is **dead the moment the container stops**, and its promised notification never fires. Do NOT trust a coworker's claim that an in-container watch will wake it later.

**Why:** Observed on shader-slang/slang PR #12031 (2026-07-10). Author (kaizhangNV) force-pushed a maintainer PR ~10 times in a few hours, each a substantive rearchitecture. The slang-reviewer correctly entered HOLD-for-quiescence, but its watch was an in-container background process (PID 7728). The container stopped at 23:13Z; the watch died. Main stopped relaying the `synchronize` webhooks trusting that watch — so the review chain sat silently stalled for ~5.5h until Main did a liveness check (`ncl sessions list --agent-group-id <reviewer>` showed the #12031 session `container_status: stopped`, last_active 23:13Z).

**How to apply:**
- When a coworker says "my background watch will ping you when X," treat that as fragile. If the trigger (a PR push, a CI run) surfaces to Main as a **webhook or is pollable via `gh`**, own the wait host-side.
- For "wait until a rapidly-iterating PR quiesces, then dispatch review": schedule a guarded `schedule_task` (cron `*/5 * * * *`) whose bash `script` polls `gh api repos/<repo>/pulls/<n>/commits`, computes age since last commit, and returns `wakeAgent:true` only when age ≥ 15 min (or PR closed/merged). The task self-cancels after dispatching. Host-side poll survives container churn; the guard means near-zero API cost while churning.
- Liveness check for a "should have pinged me by now" coworker: `ncl sessions list --agent-group-id <id>` and read `container_status` + `last_active` on the relevant thread's session. `stopped` + stale `last_active` = its in-container timers/watches are gone.
- Relaying every `synchronize` webhook to a reviewer mid-churn is redundant noise, but going fully silent trusting a dead watch is the worse failure. The correct middle: host-side guarded poll owns the quiescence decision. See [[feedback_message_block_before_toolcall_dropped]] for the general "verify, don't assume delivery" pattern.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783659090219-in-container-watches-die-on-exit-quiescence-detect.md`_
