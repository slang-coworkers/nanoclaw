---
title: "[approver/infra-abstain] The ledger is write-only from every tier — but your OUTBOX proves emission, and `processing_ack` 'NOT ACKED' on an outbound row proves NOTHING"
type: learning
topic: review-approval
source: learnings/1785786203086-approver-infra-abstain-the-ledger-is-write-only-fr.md
---

# [approver/infra-abstain] The ledger is write-only from every tier — but your OUTBOX proves emission, and `processing_ack` "NOT ACKED" on an outbound row proves NOTHING

Companion to the orchestrator's write-only-ledger note (which records the three `ncl`/session-DB probes at `global` scope). This adds a **fourth probe they didn't run**, the **one thing that IS self-verifiable**, and a **false-negative trap** that would make you report a delivery failure that didn't happen.

## Context

After correcting a retracted claim inside an already-recorded `approval_decisions` row (slang-rhi#806), I re-recorded and wanted to confirm the upsert replaced rather than appended. The orchestrator had already probed 3 ways and returned a negative. Per "never inherit a caveat unretried," I retried differently.

## Probe 4 — read the host SOURCE, not just the CLI/DBs

Their probes were all CLI + SQLite. I have read access to `/app`:

```bash
grep -rl 'approval_decisions' /app   # -> /app/src/mcp-tools/core.ts   (ONLY)
grep -rl 'record_decision'     /app   # -> /app/src/mcp-tools/core.ts   (ONLY)
ls /app   # src/ + hooks/ + scripts/, no compiled bundle -> that IS the whole app
```

Both strings appear **only in the tool definition** — the description at `core.ts:550` and the schema/handler. There is **no consumer and no table DDL in the container at all**; the handler just does `writeMessageOut({kind:'system', content: JSON.stringify({action:'record_decision', …})})`.

**Consequence worth internalizing:** "One row per (repo, pr, commit_sha) — a re-run on the same commit replaces it" is a claim made by the tool's **own doc string**, with no implementing code readable from here. It is a **contract to relay, never a state to assert**. A success return means *the call succeeded*, not that the stored row reads as intended.

Also confirmed their negative independently: `find / -name '*.db' -o -name '*.sqlite*'` (~20 hits, each opened `mode=ro`) reaches only `/workspace/inbound.db` and `/workspace/outbound.db`. No `approval_decisions`. **Name-collision trap they flagged and I confirm: `ncl approvals` is a DIFFERENT table** (in-flight self-mod/OneCLI cards, deleted after the admin responds).

## ✅ What IS self-verifiable: your own emission in `outbound.db`

Not nothing! `record_decision` writes a `messages_out` row you can read:

```sql
select seq, content from messages_out where content like '%record_decision%' order by seq;
```

For #806 this showed both writes with their payloads intact — seq 3 (`challenger_len=3487`, retracted phrase **present**) and seq 21 (`challenger_len=4426`, correction **present**, retracted phrase **gone**), same `commit_sha`. So I could prove **the corrected payload left the container with the right content**. Only the host-side upsert-vs-append remains unobservable. Verify to the boundary you actually have, then name the boundary — that is far better than "unverifiable".

## ⚠️ THE TRAP: `processing_ack` is INBOUND-only

All 12 of my `messages_out` rows read "NOT ACKED" — **including chat messages the orchestrator demonstrably received and replied to.** `processing_ack.message_id` holds `sys-`/`a2a-` **inbound** ids, never `msg-` outbound ids.

**That contradiction is the control, and it's what saved the conclusion.** Had I read "NOT ACKED" as "unconsumed," I'd have reported a false delivery failure on messages that provably arrived. `messages_out` has **no status/consumption column** at all (`id, seq, in_reply_to, timestamp, deliver_after, recurrence, kind, platform_id, channel_type, thread_id, content`) — the host drains it out-of-band, so **emission is the furthest an agent can observe by construction.** Generalizes: before reading a status field as evidence, find a row whose true status you already know independently and check the field agrees. A status column that reads the same for a known-success and a known-unknown is not a status column for your purpose.

## Reporting rule

Say **"could not verify by method M"**, M named — never "the ledger is unverifiable." It *is* fully auditable host-side by the operator; what's absent is **self**-verification. Report a ledger correction upward as **ATTEMPTED, pending operator verification** — never "resolved."

This is **structural, not a per-tier permissions gap**: the writer of an audit artifact cannot verify its own write, which is the *intended* direction for an audit trail. The consequence to carry: **a contaminated ledger reasoning-field can be repaired but not confirmed**, and because the headline fields (verdict, SHA) stay correct, nothing ever *looks* wrong.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785786203086-approver-infra-abstain-the-ledger-is-write-only-fr.md`_
