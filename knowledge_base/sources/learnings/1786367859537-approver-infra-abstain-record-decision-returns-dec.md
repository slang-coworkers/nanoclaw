---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786364054639-szdpbx
written_at: 2026-08-10T13:17:39.538Z
---

# [approver/infra-abstain] record_decision returns "Decision recorded" even when the host DENIES the ledger append — the denial arrives afterward as a separate notification

# Symptom

Recording an approval decision for slang-rhi#821, `mcp__nanoclaw__record_decision` returned:

```
Decision recorded: shader-slang/slang-rhi#821@ffa3663180b1 = ABSTAIN_POLICY
```

An unambiguous past-tense success. **No row was written.** Moments later the host delivered a separate notification:

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

An agent that stops reading at the tool result — the normal thing to do after a success string — books a decision as durably recorded when the `approval_decisions` table is untouched. In shadow mode the ledger *is* the entire deliverable, so this silently produces zero output while every artifact claims completion.

# Root cause

The MCP tool acknowledges the *call*, not the *append*. Capability enforcement (`APPROVAL_LEDGER_WRITERS` — the host checks that the calling agent group holds the ledger-writer capability) happens host-side and **asynchronously**, so the refusal cannot appear in the tool's return value. The two messages arrive on different channels in the wrong order: success first, truth second.

This is the general failure mode aimed at me from the least-suspected direction — **the instrument congratulating me.** A tool's own past-tense confirmation is still a claim about a state I did not open.

# How to catch it

1. **After any `record_decision`, treat the row as UNWRITTEN until a host-side confirmation is observed.** The tool string is an acknowledgement of receipt, not evidence of a write.
2. **Watch for a trailing host notification before you report.** The denial lands as a separate `system-notification`, after the tool result and possibly after you have already moved on. If you close the turn on the tool result you will never see it.
3. **Always write `work/<pr>-<sha12>/decision.md`** with the full field set (repo, pr, commit_sha, decision, reason_code, mode, policy_version, review_diff_hash, ts, clauses summary, challenger summary). When the append is refused this file is the only record, and it is what the operator replays once the capability is granted.
4. **Do not retry the same call to "make it stick."** The refusal is a missing capability, not a transient error; retrying just produces more false success strings. Escalate to the operator naming the env var.

# Fix

For #821 the decision (`ABSTAIN_POLICY:OPEN_GAP`) was preserved in `work/821-ffa3663180b1/decision.md` with a prominent "LEDGER APPEND DENIED" banner and the exact fields to replay, the memory child was corrected to say *decided, append denied* rather than *recorded*, and the gap was reported upstream with the ledger state disclosed. Operator action required: configure `APPROVAL_LEDGER_WRITERS` for the agent group, then re-append.

**Transferable rule: a success string from my own tooling is the same class of unverified claim as a success string from anyone else's — and it is the one I am least likely to check, because it tells me my work is done.**
