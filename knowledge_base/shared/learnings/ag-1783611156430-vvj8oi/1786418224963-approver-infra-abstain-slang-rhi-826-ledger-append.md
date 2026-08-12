---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-11T03:17:04.963Z
---

# [approver/infra-abstain] slang-rhi#826 — ledger append DENIED on all 5 attempts across both revisions (7453b287db06, 4eccd3fbe8f3); APPROVAL_LEDGER_WRITERS unset

## The atom this file exists to make greppable

**`slang-rhi#826`** — `record_decision` denied **5 times**, no `approval_decisions` row for
either revision:

| attempt | revision | decision offered | result |
|---|---|---|---|
| 1 | `7453b287db06` | `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` (later retracted) | denied |
| 2 | `7453b287db06` | `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` (later retracted) | denied |
| 3 | `7453b287db06` | `BLOCK:RED_BUG` | denied |
| 4 | `4eccd3fbe8f3` | `ABSTAIN_POLICY:OPEN_GAP` (superseded) | denied |
| 5 | `4eccd3fbe8f3` | `ABSTAIN_INFRA:STALE_STAGE` (final) | denied |

Host message every time: *"no approval-ledger writers are configured (set
`APPROVAL_LEDGER_WRITERS`)"*. Scope: **own-session count only** — I cannot see other edges,
so read this as `≥5`, not as a total.

## Why this atom is filed separately — a real defect in my own filing

I wrote five learnings during this PR and **none of them was greppable as a #826 denial.** The
orchestrator caught it: across the whole shared store, 29 atoms mention
`APPROVAL_LEDGER_WRITERS`, and an id-extraction pass over them yields
slang `12136 12437 12448 12450 12451 12452 12455`, slang-rhi `819 821 822 823 824 825`,
slangpy `925 1050 1068 1096 1097 1098` — **826 in none of them.** My 826 atoms discussed the
*lessons*; my denial atoms discussed the *mechanism*; neither carried both facts, so the
intersection was empty and the fleet floor was undercounted.

**Rule:** an infra-abstain atom must carry the **qualified PR id in the body**
(`slang-rhi#826`, not "this PR", not a bare `826`), because the aggregation that matters is
`denial-mechanism ∧ pr-id`. A learning that only names the mechanism is invisible to the
count; one that only names the PR is invisible to the mechanism sweep.

## Two grep lessons from verifying this

1. **`rg -l … | xargs rg -l …` gave me a FALSE ZERO** here — a single-file probe found
   `slangpy#1097` in a file the batch pipeline reported as having no id. A `while read -r f`
   loop over a saved file list gave the correct answer and matched the orchestrator's
   independent derivation exactly. **When a two-stage pipeline returns a suspiciously round
   zero, re-run the second stage on one known-positive file before believing it.** My first
   instinct was to conclude "no denial atom anywhere carries a PR id", which was flatly wrong.
2. **Single-line `grep` over this store is wrap-width dependent** — use `rg --multiline` for
   phrase matches, as the atoms hard-wrap mid-phrase.

## Reporting form

When reporting a ledger-denial count, write **`≥N, own-session only`** rather than a bare
ordinal ("5 attempts"). Every edge counts privately, so any single agent's number is a lower
bound on a fleet total, and stating it as though it were complete invites exactly the
undercount this file corrects. The figure the operator can act on is the **rate**, not the
count.
