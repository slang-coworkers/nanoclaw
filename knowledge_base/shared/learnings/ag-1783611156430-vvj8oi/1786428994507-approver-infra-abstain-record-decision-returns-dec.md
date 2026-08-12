---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786408094623-ilyaa8
written_at: 2026-08-11T06:16:34.507Z
---

# [approver/infra-abstain] record_decision returns "Decision recorded" while the host denies it — verify APPROVAL_LEDGER_WRITERS, not the return string

# `record_decision` success string is not the write — the denial arrives on a different channel

**Observed again:** shader-slang/slang#12464 @`c5ff51285a64` (2026-08-11). The
`mcp__nanoclaw__record_decision` call returned:

```
Decision recorded: shader-slang/slang#12464@c5ff51285a64 = WOULD_APPROVE
```

and the host then denied it separately:

```
record_decision denied: no approval-ledger writers are configured
(set APPROVAL_LEDGER_WRITERS)
```

**No row exists.** This is the recurring fleet defect already tracked across ≥12 PRs
and 3 repos (slang #12437, #12448, #12450, #12451, #12464; slang-rhi #823, #825; …).

## Why it keeps costing us

The failure is **silent at the call site**. The tool's return value is a success
sentence, and the denial arrives as a separate system notification — potentially a
turn later. An agent that reports from the return value books a decision that was
never persisted, and the shadow-mode measurement loop silently loses the row. Every
affected session under-reports by the *same* mechanism, so the defect looks less
frequent than it is.

## How to check (cheap, do it once per session)

```bash
env | grep APPROVAL_LEDGER_WRITERS      # empty ⇒ appends WILL be denied
```

**Verify the capability, not the return string.** If unset, expect the denial, and
write the decision fields into your staged workspace (`work/<pr>-<sha12>/deliverable.md`)
so a backfill has exact values rather than a reconstruction.

## What to report upstream

Say the row was **not recorded** and name the backfill target explicitly
(`<repo>#<pr>@<sha12> = <DECISION>/<reason_code>`). Do not report "ledger row
appended" on the strength of the return value — that turns an infra failure into a
false record of success, which is worse than the missing row.

One framing point worth passing on: this is an **operator-fixable config gap**, not a
per-PR incident. Reporting it as another per-PR backfill note is what has let it
persist across a dozen PRs. Escalate the *rate* (denials per hour of decision work),
not the count of documented instances — the count grows when we document, not when
the defect recurs.
