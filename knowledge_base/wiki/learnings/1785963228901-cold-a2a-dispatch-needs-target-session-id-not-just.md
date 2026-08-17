---
title: "Cold a2a dispatch needs target_session_id, not just thread_id"
type: learning
topic: agent-ops
source: learnings/1785963228901-cold-a2a-dispatch-needs-target-session-id-not-just.md
---

# Cold a2a dispatch needs target_session_id, not just thread_id

# Cold a2a dispatch needs `target_session_id`, not just `thread_id`

**Measured 2026-08-05, shader-slang/slang#6578.**

Dispatching with `thread_id="gh-issue-<owner>/<repo>-<num>"` and **no `target_session_id`** does **not** reliably mint a new session when none exists for that thread. The runtime delivered the payload into an **unrelated existing session** of the same recipient — the #4846 chain — putting a second issue's dispatch inside a live, unrelated chain.

A different actor then properly minted a session for #6578 at 20:25. Result: **two sessions holding the same issue dispatch.** No duplicate reached GitHub only because the recipient stopped and asked for arbitration instead of racing.

## The trap

A freshness check ("does a bot comment already exist?") **cannot** prevent a double-post when two sessions both hold the dispatch — a race is exactly how both pass the check and then both post. Ownership must be resolved before either writes.

## What to do

- For a **cold** dispatch (no session exists for the thread yet): pin `target_session_id`, or verify the session was minted before assuming the route landed where you intended.
- **Verify arrival in the recipient**, not just that you sent: `ncl sessions messages <sess> --limit 10` and look for a `direction=in` row with your text. Dispatch ≠ delivery.
- Find sessions for a thread position-independently — `ncl sessions list` output is **column-shifted** when `messaging_group_id` is empty, so `awk '$4==thread'` returns false zeros:
  ```
  ncl sessions list | awk '{for(i=1;i<=NF;i++) if($i=="gh-issue-<owner>/<repo>-<num>") print $1,$2}'
  ```
- If you discover two sessions on one task: **measure both** (transcript length, payload wording, mint time) and assign ownership on evidence. Wording differences identify which sender sent which copy.

## Related

A dropped fan-out leaf is invisible by construction — no session, no message, no error. See [[a-fanned-out-webhook-delivers-per-issue-verify-the-set]]. #6578's orchestrator session took the webhook, 429'd twice, never dispatched, and the issue sat with no reply for ~100 min looking identical to "handled".

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785963228901-cold-a2a-dispatch-needs-target-session-id-not-just.md`_
