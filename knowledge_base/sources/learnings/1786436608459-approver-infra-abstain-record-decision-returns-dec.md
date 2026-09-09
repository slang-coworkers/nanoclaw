---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-11T08:23:28.459Z
---

# [approver/infra-abstain] record_decision returns "Decision recorded" while the host DENIES the ledger append (APPROVAL_LEDGER_WRITERS unset)

# `record_decision` reports success on a denied ledger append

**Symptom.** On shader-slang/slang#12446 @`b4dabca51fc6` the `record_decision`
MCP tool returned the success string:

```
Decision recorded: shader-slang/slang#12446@b4dabca51fc6 = ABSTAIN_POLICY
```

and then, in the SAME minute, a host system-notification arrived:

```
record_decision denied: no approval-ledger writers are configured
(set APPROVAL_LEDGER_WRITERS)
```

The two disagree. The authoritative one is the host notification: **no ledger
row was written.** The decision existed only as local files
(`work/<pr>-<sha12>/decision.md`, `clauses.json`, `review/review-doc.md`),
which no other tier can open.

**Root cause.** The ledger append is gated host-side on the calling agent
group holding the ledger-writer capability, driven by the
`APPROVAL_LEDGER_WRITERS` host config. When that config is unset, **no group
is a writer** — so the denial is not specific to a group being excluded, it is
the fleet-wide default. The tool's return string is generated on the
call path, not from the host's write acknowledgement, so a denial that happens
after the call is accepted still reads back as success.

**How to catch it.** The success string of a write tool is a claim about a
state you did not open — the same class as every other over-claim.
Concretely:

- **Treat `record_decision`'s success string as a REQUEST ACK, not a WRITE
  ACK.** It tells you the call was accepted, not that a row exists.
- **A denial can arrive as a separate host notification AFTER the tool
  result.** Do not close a decision turn on the tool result alone — an
  out-of-band denial landing one message later still means the append failed.
  Silence is not confirmation either: only a positive read of the row is.
- Scan for the denial vocabulary explicitly: `denied`, `not configured`,
  `capability`, `WRITERS`.

**Fix.** The decision itself was sound and is NOT retracted — the abstain
still stands on its artifacts. What failed is durability, and it is an
operator-config defect, not a PR property:

1. Do **not** retry the call verbatim; the denial is a capability decision, not
   a transient error. A retry loop just re-collects the same denial.
2. Report it upstream as a named **blocker** in the report's `blocker:` field,
   with the config key (`APPROVAL_LEDGER_WRITERS`) so the operator can act.
3. Keep the local artifacts and cite their paths, while stating plainly that
   they are local-only and the ledger row is absent — so nobody downstream
   reads the decision as durably recorded.
4. Because the row is absent, the later human-verdict **join cannot happen**
   for this (repo, pr, commit): there is nothing to stamp the outcome onto.
   Every decision made while this config is unset is lost to accuracy
   measurement — which is precisely the signal shadow mode exists to collect.
   That makes it urgent, not cosmetic.

**Generalization.** Any host-side write tool whose result string is composed
locally can report success for an append the host refused. For each such tool
ask: *does this string come from the writer, or from the caller?* If the
latter, the write is unconfirmed until read back.
