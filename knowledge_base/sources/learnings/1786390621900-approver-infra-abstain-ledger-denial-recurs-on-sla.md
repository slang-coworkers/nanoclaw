---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-08-10T19:37:01.900Z
---

# [approver/infra-abstain] Ledger denial recurs on slang#12452 (≥18th PR): record_decision returns "Decision recorded" while the host denies — and the ABSTAIN relaxation path does not help

## Symptom

On slang#12452 I called `record_decision` for
`ABSTAIN_POLICY:CHALLENGER_CONCERN @ fe1feac57c06`. The tool returned:

> `Decision recorded: shader-slang/slang#12452@fe1feac57c06 = ABSTAIN_POLICY`

A host notification then arrived:

> `record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`

So the success string and the denial describe the same call. **The success string
is not the write.** Confirms the standing finding, now on another PR.

## Two things this instance adds

1. **The ABSTAIN relaxation path does not rescue it.** The approver skill notes
   that `ABSTAIN_*` rows skip the critique gate and that "the host relaxes the gate
   for `ABSTAIN_*` rows". True, and irrelevant here: the blocker is not the
   critique gate but the **missing `APPROVAL_LEDGER_WRITERS` config**. An abstain
   is denied exactly like a `WOULD_APPROVE`. Anyone reasoning "abstains at least
   get recorded" is wrong.
2. **The denial arrives on a different channel than the call.** The tool result
   says success; the truth arrives as an out-of-band host notification. If you
   only read tool results — the normal thing to do — you record a phantom write.
   `env | grep APPROVAL_LEDGER_WRITERS` returns nothing in-container, which is a
   cheap pre-check available before the call.

## Consequences

- The only durable record of this decision is
  `work/12452-fe1feac57c06/decision.md` in my own container. **Backfill needed for
  `12452@fe1feac57c06`.**
- The human-verdict join promised by the workflow cannot happen for these rows:
  with no ledger row there is nothing to stamp onto. On a merge/close event for
  such a PR, skip the join call and do the `append_learning` half only.

## How to catch it / rule

**Verify the write; don't trust the acknowledgement.** After `record_decision`,
either check for the host denial notification or pre-check the env var. Treat a
"Decision recorded" string as a claim about a call, not about a row — the same
class as an exit code being a claim about a search rather than about the world.

**Quote the PR list, never the file count.** The file count is self-referential —
each leaf documenting this defect becomes a member of the set it counts, so it
grows when you *write*, not when the defect *recurs*. The PR list is the defect's
size. Known affected (own-session floor, union previously measured from the shared
store at ≥17 across 3 repos): slang #12437, #12451, #12452 · slang-rhi #821–#825 ·
slangpy #925, #1050, #1068, #1096, #1097 — now **≥18 distinct PRs**.

**And recording is not routing.** This is documented in many leaves and still
unfixed, because no amount of documentation reaches a config file only an operator
can edit. Escalate it as well as record it, every time; a note that reads as
diligence is not a fix.
