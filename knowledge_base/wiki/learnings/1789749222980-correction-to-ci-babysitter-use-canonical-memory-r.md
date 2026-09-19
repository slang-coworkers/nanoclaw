---
title: "CORRECTION to 'ci-babysitter-use-canonical-memory-rerun-tracker': phantom-instance inference was wrong — check task session_id pin + transcript first"
type: learning
topic: agent-ops
source: learnings/1789749222980-correction-to-ci-babysitter-use-canonical-memory-r.md
---

# CORRECTION to "ci-babysitter-use-canonical-memory-rerun-tracker": phantom-instance inference was wrong — check task session_id pin + transcript first

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-18T16:33:42.980Z
---

# CORRECTION to "ci-babysitter-use-canonical-memory-rerun-tracker": phantom-instance inference was wrong — check task session_id pin + transcript first

This corrects point 4 of `1789748229938-ci-babysitter-use-canonical-memory-rerun-tracker-j.md` (filed 2026-09-18T16:17Z).

**What that point claimed:** "There can be multiple concurrent CI-babysitter sweep instances operating on the same repo" — inferred from finding canonical-tracker entries at 04:11Z/10:09Z/14:05Z that the session didn't remember writing.

**Why it was wrong:** The babysitter is driven by exactly one scheduled task (`task-1776715487702-ftr4s6`, cron every 2h) which is pinned to a **single, fixed `session_id`** — verified via `ncl tasks get <series-id>`, which reports the session that runs the task. There is no fresh-session-per-fire. Pulling that session's own transcript (`ncl sessions messages --id <session-id> --limit 80 --reverse`) showed an unbroken chain of sweep turns at every one of those "unrecognized" timestamps, interleaved with the live interactive conversation — i.e. it was this same session's own history, invisible only because 2+ days of prior sweeps had compacted out of active context (made worse by the wrong-tracker-path split in points 1–3, which hid the session's own recent canonical writes from itself too). There was never a second live instance.

**The actual fourth failure mode, going forward:** for a long-running cron-woken session, "state I don't remember creating" is far more likely to be your own compacted-out history than a concurrent actor. Before flagging/escalating a suspected concurrent-instance problem, run the cheap diagnostic first: `ncl tasks get <series-id>` to read the pinned `session_id`, then `ncl sessions messages --id <that-session-id>` to check whether the unrecognized entries line up with your own session's earlier turns. Two tool calls settle it — cheaper than raising it as an open question and much cheaper than it becoming a human-decision escalation that didn't need to happen. (Flagging the appearance to the orchestrator was reasonable given the evidence at the time; the lesson is to run this check *before* the flag, not instead of ever flagging.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789749222980-correction-to-ci-babysitter-use-canonical-memory-r.md`_
