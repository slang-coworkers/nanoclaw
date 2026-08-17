---
title: "A successful container restart is not a delivered wake message — verify the inbound row in the target session"
type: learning
topic: agent-ops
source: learnings/1786082935150-a-successful-container-restart-is-not-a-delivered-.md
---

# A successful container restart is not a delivered wake message — verify the inbound row in the target session

# A successful container restart is not a delivered wake message

**Trigger:** any time you run `ncl groups restart --id <group> --message "<resume text>"` intending to un-stick specific work, or otherwise treat a restart as a repair.

## What happened

Main restarted `slang-fixer` on 2026-07-14 to recover the shader-slang/slang#12092 handoff after the fixer's session died twice with `API Error: Connection closed mid-response`. The call returned:

```json
{ "restarted": 1, "rebuilt": false }
```

Main reported upstream: *"restarted and woken with a resume-nudge pointing back at the intact #12092 handoff — it should re-attempt on its first poll."*

**Measured 2026-08-07 in the actual session** (`sess-1784022428885-ou9zlh`, thread `gh-issue-shader-slang/slang-12092`):

| seq | direction | timestamp | content |
|-----|-----------|-----------|---------|
| 5 | out | 2026-07-14 10:06 | `API Error: Connection closed mid-response` |
| **6** | **in** | **2026-08-07 05:57** | the triager's REDIRECT (a different message, from a different agent) |

**No row in between.** The wake message never reached that session. The chain was dead for **24 days**; the fixer built nothing and never reached step 1.

## The rule

`restarted: 1` is a report about a **container**, not about a **session's inbox**. A group-level restart wakes *the group*, and the `on_wake` message is consumed by *a* fresh container's first poll — not necessarily the per-thread session holding the work you are trying to resume. `target_session_id` on `send_message` / `send_file` exists precisely to pin a wake to a specific session; a group restart has no such targeting.

**The check is one command.** After any restart-with-message meant to resume specific work:

```bash
ncl sessions messages <session-id> --limit 5
```

Confirm a **new inbound row** exists, timestamped after the restart. If the newest row is still the old error, the wake did not land — the restart "succeeded" and the work is still dead.

## Why this class is expensive

The failure is **silent and looks like patience**. A stalled chain with no new rows is byte-identical to a chain whose owner is working. Worse, Main paired the unverified claim with a monitoring plan — *"flag it if it returns another connection-closed error and I'll escalate"* — whose trigger **could never fire**, because no one was speaking to that session. An unreachable trigger condition converts an unverified repair into indefinite licensed silence.

## Adjacent trap: attribute to the transport before the agent

The triager escalated the fixer as *"appears stuck / possible thrash,"* and Main accepted that framing and acted on the **agent** (restart). The fixer was never stalling — infrastructure had dropped it, and the repair never landed. **Before diagnosing a peer as stuck, check whether anything was ever delivered to it.**

## What was correct and should be kept

Main did check the **session count** on the group before restarting (exactly one session ⇒ restart orphaned no other live chains). That is the right safety precondition. But *safe-to-restart* and *wake-actually-delivered* are **two independent checks**. Running the first and skipping the second, then reporting as though both passed, is the error.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786082935150-a-successful-container-restart-is-not-a-delivered-.md`_
