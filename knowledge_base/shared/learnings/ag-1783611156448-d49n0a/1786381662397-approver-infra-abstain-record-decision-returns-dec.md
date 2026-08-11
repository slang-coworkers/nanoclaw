---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786379121026-lgq3jn
written_at: 2026-08-10T17:07:42.397Z
---

# [approver/infra-abstain] record_decision returns "Decision recorded" even when the host DENIES the append — the denial arrives as a separate notification

# [approver/infra-abstain] `record_decision` returns success while the host denies the write — read the notification, not the return string

## Symptom

Recording the slangpy#1097 decision (2026-08-10), the `record_decision` MCP tool returned:

```
Decision recorded: shader-slang/slangpy#1097@9d502374c933 = ABSTAIN_POLICY
```

Seconds later, a separate system notification arrived:

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

**No ledger row exists.** The two messages flatly contradict each other, and the optimistic
one is the one delivered in the tool-result slot you naturally treat as authoritative. If you
stop at the return value you will report "ledger row recorded" upstream, and the row a human
later goes looking for is not there.

## Root cause

The tool is fire-and-forget across a host boundary: the handler enqueues an outbound
`messages_out` row and returns its own optimistic string. Host-side authorization
(`APPROVAL_LEDGER_WRITERS`, a group capability) is evaluated **after** the return, so the
denial can only come back out-of-band as a notification. The return string therefore attests
that *the call was emitted*, never that a row was stored — the same boundary as the
write-only-ledger note: the writer of an audit artifact cannot confirm its own write.

## How to catch it

1. **Never quote the tool's success string as proof of a row.** Treat it as "emitted".
2. **Verify emission at the boundary you do have** — your own outbox:
   ```sql
   -- sqlite3 'file:/workspace/outbound.db?mode=ro'
   select seq, length(content) from messages_out
    where content like '%record_decision%' order by seq desc limit 5;
   ```
   Grep the payload for the pr number, SHA, decision and `policy_version` to prove the
   *content* left intact (mine: seq 3, 6945 bytes, all fields present). Trap to remember:
   `processing_ack` is INBOUND-only, so "NOT ACKED" on an outbound row proves nothing.
3. **Scan for a denial notification** before writing the report. Absence of a denial is not
   proof of success, but its presence is proof of failure.
4. `env | grep APPROVAL_LEDGER` from the container shows nothing either way — the var is
   host-side, so a local check cannot pre-empt this.

## Fix

- The verdict itself is unaffected: a ledger-write denial is an infra/config gap and must
  **never** change the decision. Do not downgrade an `ABSTAIN_POLICY` to `ABSTAIN_INFRA`
  because the append failed — the reason_code describes the PR, not the plumbing.
- Report the ledger row as **ATTEMPTED, pending operator action**, naming the exact blocker
  (`APPROVAL_LEDGER_WRITERS` unset) and what you did verify (emission + payload contents).
  Say "could not verify by method M", M named — never "recorded".
- Escalate the config gap to the operator: only an admin can set the writers list, so every
  decision from this group is currently un-persisted, and the shadow-mode measurement is
  silently accumulating zero rows while each individual decision *looks* fine.
