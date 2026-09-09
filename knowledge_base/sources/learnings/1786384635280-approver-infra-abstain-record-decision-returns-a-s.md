---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383757711-r662wl
written_at: 2026-08-10T17:57:15.280Z
---

# [approver/infra-abstain] record_decision returns a success STRING while the host DENIES the append — APPROVAL_LEDGER_WRITERS unset

## Symptom

On shader-slang/slang#12437 @`fd44c9ecfd9a` the `mcp__nanoclaw__record_decision`
tool result read, verbatim:

```
Decision recorded: shader-slang/slang#12437@fd44c9ecfd9a = ABSTAIN_POLICY
```

One turn later the host delivered a system notification:

```
record_decision denied: no approval-ledger writers are configured
(set APPROVAL_LEDGER_WRITERS)
```

Both describe the same call. The tool's own return value said the append
succeeded; the host said it never happened. **No ledger row exists.** An agent
that reads only the tool result will report a decision as recorded, book the
task complete, and the audit trail will be silently empty — the exact failure
the ledger exists to prevent.

## Root cause

The success string is emitted by the MCP tool layer (request accepted /
well-formed), not by the host component that performs the append. The
capability check — the agent group must hold the ledger-writer capability, i.e.
be listed in `APPROVAL_LEDGER_WRITERS` — is enforced host-side, downstream of
the string, and its refusal comes back on the *notification* channel rather
than as a tool error. So the two channels disagree by construction whenever the
capability is missing.

The tool's own description says the host "ENFORCES that your agent group holds
the ledger-writer capability — a call from any other group is denied and you are
told so". It is true that you are told. It does not say you are told *in the
tool result*, and you are not.

## How to catch it

- **The host notification outranks the tool's return string.** This is the same
  shape as "I cannot observe my own transport — only the receiver can": a
  component reporting on its own success is the weaker witness. When the two
  disagree, the one describing the *effect* wins over the one describing the
  *request*.
- **A write is not done until something that is not the writer confirms it.**
  For `record_decision`, treat the call as PENDING until either the host is
  silent through the end of the turn or you can read the row back. A success
  string alone is not proof.
- Do not paper over it: with no ledger, say the row is missing and name
  `APPROVAL_LEDGER_WRITERS` as the artifact. The DECISION is still valid — only
  its persistence failed. Keep `work/<pr>-<sha12>/decision.md` as the interim
  record and state plainly that it is the only copy.

## Fix

Operator sets `APPROVAL_LEDGER_WRITERS` to include the approver's agent group,
then the (repo, pr, commit_sha) row is re-appended — the ledger is append-only
with first-write-wins per (repo, pr, commit_sha), so a re-append of the SAME
decision after the config is fixed is a safe no-op-or-insert, not a conflict.

Generalization worth carrying: **an over-claim can originate in my TOOLS, not
just in my prose.** The scrutiny aimed at my own claims is owed to the strings
my instruments hand me.
