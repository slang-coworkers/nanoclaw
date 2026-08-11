---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-08-11T00:00:58.448Z
---

# [approver/infra-abstain] Escalate the RATE, not the cumulative count — and an ordinal counted from one session is structurally low, not sloppy

## The correction

I escalated the `APPROVAL_LEDGER_WRITERS` denial as "**17 distinct PRs** across 3
repos", measured by grepping `/workspace/shared/learnings`. The orchestrator
re-measured on its own edge with a prefixed-id regex over 24 denial-bearing files
and got **18**: slangpy `925 1050 1068 1096 1097 1098` · slang-rhi
`819 821 822 823 824 825` · slang `12136 12437 12448 12450 12451 12452`. I had
missed `slang#12136`. (`#918`/`#1002` are correctly excluded — those are
`record_human_verdict` stamps, a different tool with its own persistence problem,
merely co-located in denial-bearing files.)

## Why the number is the wrong instrument, not just wrong

Two independent problems, and the second is the important one:

1. **Every count is stale within hours.** The orchestrator's own published figure
   went 12 → 16 → 17 → 18 in a single day. Any ordinal I quote is obsolete before
   an operator reads it.
2. **The count also *measures my writing***: each leaf documenting the defect
   becomes a member of the set being counted. I have this recorded already ("quote
   the PR list, never the file count") and the PR-id list is better — but it still
   grows when we document, not only when the defect recurs.

**Better instrument, adopted from the orchestrator: count EVENTS, not IDs.**
Denial-atom mtimes give **11 denied writes across two approver groups in the 7.2 h
window 15:09Z → 22:22Z ⇒ ~1.5 dropped decisions/hour.** That has no
id-attribution problem at all, doesn't decay into staleness the same way, and
states the operator-relevant quantity: ongoing loss per unit time. Note the
orchestrator had to **subtract 2 atoms of its own commentary** from that window
first — counting your own notes as denial events inflates the rate, the same
self-referentiality that spoils the file count.

## The structural point worth keeping

⭐⭐ **An ordinal counted from a single session is a floor of a floor, and it reaches
the operator as if it were a fleet total.** Each approver session can only see its
own hits, so **every edge under-reports by the same mechanism** — this isn't
carelessness, and it biases in the direction that makes the fix look *less*
urgent, i.e. toward the operator not fixing it.

Corollary about ownership: the shared-learnings directory is the only edge that
sees the union, and it belongs to the orchestrator — so the recount is genuinely
its job, not mine. ⭐ **Name whose edge can see the union before quoting a total.**
When I can only see my own hits, the honest form is "≥N, own-session only" plus a
handoff, not a bare number.

## Rule

- For a recurring infra defect: escalate **rate over a stated window**
  (events/hour, with the window), not a cumulative id count.
- Subtract your own artifacts from any window you measure — your documentation is
  not an occurrence of the defect.
- Mark every ordinal with the scope that produced it. "18th" from an edge that
  sees one session is a different claim from "18th" measured over the union.
