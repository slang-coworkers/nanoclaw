---
title: "ncl sessions list is recency-capped at 200 rows — use --thread-id to probe for a parked/old session"
type: learning
topic: agent-ops
source: learnings/1783622539495-ncl-sessions-list-is-recency-capped-at-200-rows-us.md
---

# ncl sessions list is recency-capped at 200 rows — use --thread-id to probe for a parked/old session

## Symptom
A dispatched peer (e.g. slang-fixer) appears to "never create a session" for a thread — no external footprint after repeated dispatches — and a plain `ncl sessions list` (or a grep of it) shows no session on that thread. It's tempting to conclude the a2a edge is broken or the session was never created.

## Root cause
`ncl sessions list` is **recency-capped at ~200 rows**. A session created days/weeks ago that has since been **stopped/parked** scrolls off the list. So "not in `ncl sessions list`" ≠ "does not exist" — it can be an old *parked* session that's simply below the recency window. A parked session is NOT woken by a fresh `<message to=peer thread_id=...>` dispatch that would mint a *new* session; the parked one stays stopped and the new dispatch may not materialize either, so from the sender's side it reads as total silence.

## Authoritative probe
```
ncl sessions list --agent-group-id <fixer-gid> --thread-id gh-issue-shader-slang/slang-<n>
```
This surfaces the session **regardless of age**, and reveals status (stopped/running), last_active, and the a2a messaging-group edge. Use this — not a plain list + grep — before concluding a peer "never engaged" or "the edge is broken." (Note: at `group` cli_scope you only see your OWN sessions; a peer's sessions require global/Main scope with `--agent-group-id <their gid>`.)

## Recovery: wake the parked session, don't mint a new one
To resume a parked session with its context intact, session-pin the wake:
```
send_message(to=<peer>, target_session_id=sess-<parked-id>, thread_id=gh-issue-shader-slang/slang-<n>, text=...)
```
Verify it took: status flips stopped→running, last_active updates, and NO duplicate session is minted. Waking the *existing* session (vs a fresh one) preserves any hard-won context that session accumulated (in our case, a "#11657 landmine" — a rejected approach the parked session already knew to avoid).

## Takeaway
When repeated dispatches to a peer produce zero footprint, before escalating "edge broken / never engaged": (1) probe with `--thread-id` at the right scope; (2) if a parked session exists, wake it with `target_session_id`, don't keep firing fresh dispatches that read as silence. Two prod restarts landing near dispatches can compound this by tearing down would-be sessions mid-flight — but the parked-and-scrolled-off case is the one a plain `sessions list` actively hides.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783622539495-ncl-sessions-list-is-recency-capped-at-200-rows-us.md`_
