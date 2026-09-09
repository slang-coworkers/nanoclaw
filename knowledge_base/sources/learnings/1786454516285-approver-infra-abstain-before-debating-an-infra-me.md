---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784029055883-32vkjs
written_at: 2026-08-11T13:21:56.285Z
---

# [approver/infra-abstain] Before debating an infra mechanism with a peer, grep your OWN work tree — the recorded host denial was there all along; and a silent log is not a clean run (test with a known-positive)

## Symptom

Two tiers spent two full round-trips arguing about whether the approval-ledger
append succeeded, reasoning entirely from *absences* in our own containers:

- Orchestrator: "`APPROVAL_LEDGER_WRITERS` is unset, the ledger fails closed, so
  nothing was appended" — sourced from a **repo doc read inside their own
  container**, not the host.
- Me: "`find /` for `approval_decisions*` → 0 hits" — worthless, because the
  store is host-owned by design.

Neither of us ran the cheapest possible query: `grep -rn APPROVAL_LEDGER_WRITERS`
over my own `/workspace/agent` tree.

## Root cause 1 — the answer was in my own store

That grep returns **positive evidence**: past sessions captured the actual host
notification verbatim —

```
record_decision denied: no approval-ledger writers are configured
(set APPROVAL_LEDGER_WRITERS)
```

— in `work/12437-fd44c9ecfd9a/decision.md:38-40`,
`work/12136-25d3e44ed532/replay-payload.md:3`, plus `work/12450…`, `work/12451…`,
`work/827…`. The fail-closed mechanism is **real and observed**, not an
inference.

So the peer's *conclusion* was right — for a reason neither of us held — while
the *evidence* they offered for it was genuinely invalid.

⇒ **"You were wrong" and "your claim was false" are different findings.** A
correct conclusion reached from invalid evidence still needs its real evidence
located; don't let a successful refutation of the *reasoning* convince you the
*claim* is false.

⇒ **The §0 store-search rule isn't only for PR facts. Re-fire it the moment the
question turns into an infra question.** Both tiers had "search the store first"
in their standing rules and neither fired it, because the topic had drifted from
"this PR" to "the host".

## Root cause 2 — the date asymmetry that nearly became a second false claim

Every recorded denial is **August**. My enqueue for slang#11377 is
**2026-07-14T12:40:25Z**, and the deciding session's own log has **zero** hits
for `record_decision` / `denied` / `approval-ledger`. I was one sentence from
reporting: *"no denial in July ⇒ the July append probably succeeded."*

**Positive control refuted it.** I grepped the logs of sessions that were
*provably* denied (all six 2026-08-10 logs): they contain **0** denial strings
too. The container log never captures this event class at all — denials survive
only where a session hand-wrote them into `decision.md`, and the July session was
torn down mid-flight, so it wrote none.

⇒ **A SILENT LOG IS NOT A CLEAN RUN.** Before reading absence-in-a-log as
evidence, run a **known-positive** case through the *same* instrument. If the
known-positive is also silent, the instrument is blind to that event class and
your absence carries zero bits.

This is the second inference of mine to die to its own control in one session —
the first being "row still in the queue ⇒ never consumed", killed by checking
rows the peer demonstrably received (they persist identically). Both were
presence/absence arguments run through an instrument I hadn't calibrated.

## Fix

- Verdict for #11377 stays **UNKNOWN** — most likely denied, by base rate over
  the observed August pattern, explicitly *not* asserted as fact.
- Escalate the real question to the operator with the real evidence: the
  verbatim denial strings from my `work/` tree, not either container's absence.
- Do not re-record (append-only / first-write-wins).
- Separately real: `mcp-tools/core.ts:604` returns `ok("Decision recorded: …")`
  unconditionally after a bare enqueue — that string generates every past-tense
  "Ledger recorded" note. Tool defect; should say *enqueued* or surface host
  disposition.

## The cheap-check ordering that would have skipped both rounds

1. grep my own `work/` + `logs/` for the mechanism name.
2. Only then reason about the host.
3. Before any absence-based claim, calibrate the instrument on a known-positive.
