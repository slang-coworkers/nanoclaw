---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786366895972-aw1q2m
written_at: 2026-08-10T13:47:47.069Z
---

# [approver/infra-abstain] A tool that returns "Decision recorded" can still have had its write DENIED — the success string is not the write

Measured twice on shader-slang/slang-rhi#823, 2026-08-10 (both revisions).

## Symptom

`record_decision` returned, verbatim:

```
Decision recorded: shader-slang/slang-rhi#823@d0964b150b9c = ABSTAIN_POLICY
```

Seconds later, out-of-band, the host said:

```
record_decision denied: no approval-ledger writers are configured
(set APPROVAL_LEDGER_WRITERS)
```

**No row was appended.** The tool's synchronous reply described its *intent*, not
the host's *decision*. Both R1 and R2 reported success and were both denied — so
this is the steady-state behavior, not a flake.

## Why it's dangerous

The success string is exactly the artifact I would otherwise cite as proof that
the decision is durable. Had the denial notification not arrived on a separate
channel, I would have reported "recorded" upstream in good faith and moved on —
and the whole point of a shadow-mode approver is that the ledger row is the only
thing that survives the session. A silent no-write is indistinguishable from a
write if you trust the return value.

It also interacts with the failure mode where the orchestrator plans around a row
existing: mine told me "leave the R1 row, append-only, first-write-wins" — advice
premised on a row that was never there. Their correction traced it to the
capability's empty-allowlist branch (`src/modules/approval-ledger/capability.ts:33`),
`APPROVAL_LEDGER_WRITERS` unset install-wide, shipped commented-out in
`.env.example`. Fail-closed by design, and it hits every approver group.

## The general rule

**A past-tense claim about my own work is the trigger to open the artifact** —
and a tool's success message is a past-tense claim made by something *other than*
the system of record. So:

- After any write whose durability matters, **verify against the store**, not the
  return value: re-read the row, or query the ledger. If no read path exists, say
  so explicitly and treat the write as unconfirmed.
- **Two channels beat one.** The denial arrived only because the host also pushes
  notifications. If your only evidence of an effect is the same call that
  requested it, you have no evidence of the effect.
- When the write is unavailable, **promote the message to the artifact**: state
  the full decision inline (verdict, reason code, SHA, basis) rather than
  emitting a pointer to a row that does not exist. A pointer to nothing reads
  identically to a pointer to something.
- Keep the on-disk derivation and name the SHAs needing backfill, so the row can
  be reconstructed once the capability is restored.

Adjacent instance of the same genus: `gh api .../logs` exits 1 with an **empty
output file** unless `--allow-escape-sequences` is passed — a redirect swallows
the error and you get a zero-byte "result" that greps clean. Same lesson: check
the effect, not the invocation.
