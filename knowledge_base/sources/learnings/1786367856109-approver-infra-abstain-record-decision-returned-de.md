---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1785940563511-g0y3i3
written_at: 2026-08-10T13:17:36.109Z
---

# [approver/infra-abstain] record_decision returned "Decision recorded" and the host then denied it (no APPROVAL_LEDGER_WRITERS) — the write-success-vs-no-op trap I filed on Aug 5, firing in real time; and record_human_verdict does not exist as a tool

# [approver/infra-abstain] The ledger write reported success, then the host denied it

## Symptom

Recording BLOCK on slangpy#925 @ `3627a9a032f3` after an approved DECISION_REVIEW:

```
mcp__nanoclaw__record_decision(...)  →  "Decision recorded: shader-slang/slangpy#925@3627a9a032f3 = BLOCK"
```

Then, asynchronously, the host:

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

**The tool's synchronous return value said success; the actual outcome was a denial.** So the
ledger row does not exist, and had I not received the host notification I would have reported
a recorded decision that isn't there.

This is the exact trap I filed on 2026-08-05 (*"a write whose response can't distinguish
success from no-op fabricates an accomplished change"*) — except worse in one respect: that
entry worried about *indistinguishable* responses. Here the response was **affirmatively
wrong**, and the correction arrived out-of-band on a channel I don't control.

Second finding, same attempt: **`record_human_verdict` does not exist** —
`Error: No such tool available: mcp__nanoclaw__record_human_verdict`. On Aug 5 I called it
twice and reported "Human verdict recorded" for `#918` and `#1002`. So either the tool was
removed since, or those two calls also went somewhere other than the ledger. Either way, **the
two verdict stamps I reported on Aug 5 must now be treated as unconfirmed**, not merely
unverified — the tool backing them is absent today.

## Root cause

`APPROVAL_LEDGER_WRITERS` is a host-side allowlist of agent groups permitted to append. The
`record_decision` tool description states the host *enforces* group membership and that a call
from any other group "is denied and you are told so" — which is accurate, but the denial is
**not** the tool's return value. The MCP layer acknowledges receipt; the host adjudicates
after. Two different events, and only the first looks like a result.

Compounding it: my group evidently isn't in the allowlist, so **every decision I have recorded
in this configuration may be absent from the ledger.** That silently undermines the entire
shadow-mode measurement program — the abstains, the BLOCKs, and the calibration joins alike.
It also retroactively explains something I could not explain on Aug 5: only **1 of 57**
workspaces retained a `record-payload.json`, and I could not read `approval_decisions` at all.
I attributed that to workspace cleanup. **A missing writer permission fits the evidence better
than cleanup does**, and I should have generated that hypothesis then.

## How to catch it

- **Never treat an MCP tool's success string as proof of a host-side write.** Ask what the
  host does *after* acknowledging, and whether authorization is checked there.
- **Verify tool existence before reporting an action performed with it.** A tool that vanished
  between sessions turns a past report into a false claim; the skill's prose naming a tool is
  not evidence the tool is registered.
- For any allowlist-gated write, confirm membership **before** the write, not by attempting it:
  the attempt's response won't tell you.

## Fix / current state

- **#925 @ `3627a9a032f3` is decided but NOT recorded.** Verdict BLOCK,
  `VERIFIED_BUG:linux_wheel_version_override_shadowed`, DECISION_REVIEW approved round 3. The
  full derivation is on disk at `work/925-3627a9a032f3/` (`clauses.json` with `policy_path`,
  `review/review-doc.md`, `review/investigation.md`) so the row can be appended once a writer
  is configured. **Reporting it as recorded would be false.**
- Escalate to the operator: `APPROVAL_LEDGER_WRITERS` must include this group, and the
  question of how many prior decisions were silently dropped needs answering before any
  agreement statistic is computed from the ledger.
- Downgrade the Aug-5 `#918` / `#1002` stamps from "issued, effect unverifiable" to
  **"unconfirmed — the tool is not present today."**
- The `record-payload.json` 1-of-57 retention is now better explained by writer denial than by
  cleanup; treat that earlier inference as superseded.

**Method note:** the host notification is the only reason I know. That is a fragile
verification channel — it arrived as an interrupt, and a turn that had already ended would have
missed it. **When a write matters, the acknowledgement is not the receipt.**

Siblings: "a write whose response can't distinguish success from no-op"; "every copy on disk
never settles what a run did"; the four-instrument-variants table.
