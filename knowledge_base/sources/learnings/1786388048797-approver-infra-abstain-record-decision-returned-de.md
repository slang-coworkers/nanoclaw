---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786370954147-sggcnr
written_at: 2026-08-10T18:54:08.797Z
---

# [approver/infra-abstain] record_decision returned "Decision recorded" while the host DENIED the append — 4th+ instance, APPROVAL_LEDGER_WRITERS unset; the success string is not the write

## Symptom

On slang#12450 the `record_decision` MCP tool returned:

```
Decision recorded: shader-slang/slang#12450@20e0d6b4923a = WOULD_APPROVE
```

In the **same turn**, a host notification arrived:

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

There is **no `approval_decisions` row**. The tool's own success string described an append that did
not happen.

## Root cause

The host enforces that the calling agent group holds the ledger-writer capability. With
`APPROVAL_LEDGER_WRITERS` unset, **no group qualifies**, so every append is refused — while the tool
result still reads as success. The write path and the reporting path disagree, and only the host
notification reveals it.

This is at least the **4th observed instance** (previously on slang-rhi#823 ×2, slang-rhi#825,
slang#12437). That makes it a **standing configuration defect**, not a flake: every decision recorded
while it persists is silently lost, and the backfill list grows without anyone noticing.

## How to catch it

1. **Never treat a tool's success string as proof of persistence.** After any ledger append, look for
   a host denial notification in the same turn, and — where a read path exists — read the row back.
   Two different channels; only one is authoritative about state.
2. **Keep a local artifact that is sufficient to reconstruct the row**: the full decision fields
   (repo, pr, commit_sha, mode, decision, reason_code, review_diff_hash, policy_version, clauses,
   challenger, ts) written to `work/<pr>-<sha12>/decision.md`. When the ledger is unavailable that
   artifact is what a backfill will be built from.
3. **Report the actual state upstream, exactly once.** Do not write "ledger row recorded" alongside a
   caveat that it may not have persisted — that is two contradictory states in one report. Call the
   tool first, observe the outcome, then write a single claim. (A reviewer caught me drafting exactly
   that contradiction.)
4. **Escalate the config, not the symptom.** The fix is an operator setting
   `APPROVAL_LEDGER_WRITERS`; the ask should name the specific SHAs needing backfill, not just
   "check the env var".

## Fix

Recorded the denial in `decision.md` under a heading that states the true state ("LEDGER APPEND
DENIED — no ledger row exists"), listed the SHA for backfill, and reported it upstream as the
blocker.

Note on phrasing, from the same review: I first called the local artifact the "sole durable record" —
an over-claim (the session transcript and staged review artifacts persist too). The load-bearing fact
is narrower and stronger: **no ledger row exists**, and this file is the primary local decision
artifact.

**Transferable rule: the success string is not the write. A tool's self-report is evidence about the
tool, not about the persisted state — the scrutiny you aim at your own prose is owed to the strings
your instruments hand you.**
