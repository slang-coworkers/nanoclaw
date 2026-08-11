---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784180176857-773lfi
written_at: 2026-08-10T22:22:55.644Z
---

# [approver/infra-abstain] record_decision can print SUCCESS while the host DENIES the ledger append — the two arrive on different channels

## Symptom

On shader-slang/slang#12136 @`25d3e44ed532` (2026-08-10) `record_decision` returned the text:

```
Decision recorded: shader-slang/slang#12136@25d3e44ed532 = ABSTAIN_POLICY
```

and the host then emitted, as a separate system notification:

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

**The row was NOT written to `approval_decisions`.** Had I stopped at the tool result — which
reads exactly like every successful append I have ever made — I would have reported a recorded
decision that does not exist, and the join for that commit would later find nothing.

## Root cause

The tool's success string and the host's authorization result travel on **different channels**.
The string is emitted by the tool wrapper; the allow/deny is enforced host-side against a
capability list (`APPROVAL_LEDGER_WRITERS`) and surfaced as a notification. Nothing in the tool
result reflects the host's decision, so the success text is not a receipt.

## How to catch it

- **After every `record_decision`, look for an accompanying host notification before claiming
  the row exists.** A denial can arrive in the same turn, after the tool result.
- **The host notification is authoritative about host state; the tool string is not.** Same
  asymmetry as trusting a peer's report of my transport over the harness's description of it.
- **Generalize past this tool: a write is not confirmed by the writer's own success message.**
  The confirming evidence has to come from the system that owns the state — read the row back,
  or read the authorization channel. `LEDGER + work/<pr>-<sha12>/decision.md OUTRANK my memory
  file` already assumed the ledger row exists; this is the failure mode where it doesn't.
- ⭐ This is the **false-positive mirror** of a false capability-negative: a false capability-
  *positive* also has no observable failure signature at the time — everything looks like it
  worked, and the gap only surfaces at join time, when the reason is long gone.

## Fix

1. Treat the decision as **NOT RECORDED**; write the full decision to
   `work/<pr>-<sha12>/decision.md` as the durable record, with an explicit
   `⚠️ LEDGER STATE: NOT RECORDED (host-denied)` banner naming the missing config.
2. Escalate to the operator to set `APPROVAL_LEDGER_WRITERS` for the agent group.
3. Replay the append afterwards — `record_decision` is idempotent per
   `(repo, pr, commit_sha)`, so a replay corrects in place with no duplicate row.
4. Report the decision upstream anyway, stating the ledger state explicitly. An unrecorded
   decision that is reported is recoverable; a silently-unrecorded one is not.
