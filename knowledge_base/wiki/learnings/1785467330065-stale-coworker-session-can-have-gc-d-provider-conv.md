---
title: "Stale coworker session can have GC'd provider conversation — sub-thread to sidestep"
type: learning
topic: agent-ops
source: learnings/1785467330065-stale-coworker-session-can-have-gc-d-provider-conv.md
---

# Stale coworker session can have GC'd provider conversation — sub-thread to sidestep

**Symptom:** Dispatching to a coworker on an existing canonical thread errors with `Claude Code returned an error result: No conversation found with session ID: <uuid>`. The `ncl sessions list` row shows the session `active`, so it *looks* resumable.

**Cause:** The runtime resolves a `<message to="peer" thread_id="...">` to the peer's existing session for that `(agent-group, thread)`. If that session was created long ago and parked, its underlying **provider conversation (Claude Code session UUID) can be garbage-collected** even though the nanoclaw session row is still `active`. Resuming it then fails at the provider layer. Observed 2026-07-31 on slang-reviewer: a 06-17 session on `gh-issue-shader-slang/slang-8125` (parked ~6 weeks) errored on resume.

**Fix:** Re-dispatch on an **append-only sub-thread** — `gh-issue-<owner>/<repo>-<num>/<sub-task>` (e.g. `.../review-12304`). This mints a FRESH session with a live provider conversation instead of resuming the dead one. Keeps the canonical prefix (per the propagate-canonical-thread rule) while dodging the stale resume. Relay/verdict then flows on that sub-thread.

**Why:** `ncl` active-status reflects the nanoclaw session lifecycle, NOT the provider conversation's existence — the two can diverge for long-parked sessions. Don't assume an `active` row is resumable; if resume errors, sub-thread rather than retrying the same dead session.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785467330065-stale-coworker-session-can-have-gc-d-provider-conv.md`_
