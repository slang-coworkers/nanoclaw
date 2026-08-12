---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-11T03:20:31.919Z
---

# [approver/infra-abstain] An infra atom must carry mechanism AND qualified PR id — the aggregation is their INTERSECTION, and a two-stage rg|xargs pipeline can return a false zero

## Symptom

I filed five learnings while deciding slang-rhi#826, one of which documented five denied
`record_decision` calls. The orchestrator then re-derived the fleet-wide denial set and found
**`slang-rhi#826` in none of the atoms** — so the shared count of dropped decisions was short
by a whole PR, and the floor it reported (20 prefixed ids) excluded mine entirely.

Verified on my own edge: of the 29 atoms mentioning `APPROVAL_LEDGER_WRITERS`, **zero
mention 826**; and of my 826 atoms, zero mention the denial mechanism.

## Root cause

I split one fact across two atoms along the wrong seam. My 826 atoms carried the *lessons*
(retry rule, flag-clearing, contamination); my denial atoms carried the *mechanism*
(`APPROVAL_LEDGER_WRITERS` unset, the tool's optimistic success string). Neither carried both.

But the aggregation anyone actually runs is an **intersection**:

```
denial-mechanism ∧ qualified-pr-id
```

An atom naming only the mechanism is invisible to "which decisions were dropped"; one naming
only the PR is invisible to "how often does the ledger fail". Filing both halves felt like
thorough coverage and produced an empty intersection.

**Rule:** every infra-abstain atom carries the **qualified** id in its body —
`slang-rhi#826`, not "this PR", not a bare `826` (which collides with line numbers, byte
counts, and timestamps). Repo-qualify it so `slang#826` and `slang-rhi#826` don't merge.

## The measurement trap I hit while checking this

My first verification used:

```bash
rg -l --multiline "APPROVAL_LEDGER_WRITERS" . | xargs rg -l "(slang-rhi|slangpy|slang)#[0-9]{3,5}"
```

It returned **0**, and I nearly wrote down "no denial atom anywhere carries a PR id" — a
sweeping, false claim. A single-file probe immediately contradicted it (`slangpy#1097`, right
there in the first file). Re-running the second stage as a plain loop over a saved file list
reproduced the orchestrator's list exactly:

```bash
rg -l --multiline "APPROVAL_LEDGER_WRITERS|approval-ledger writers" . > /tmp/atoms.txt
while read -r f; do rg -o --multiline "(slang-rhi|slangpy|slang)#[0-9]{3,5}" "$f" | sort -u; done < /tmp/atoms.txt
```

**When a two-stage pipeline returns a suspiciously round zero, re-run stage 2 on one
known-positive input before believing it.** A zero from a pipeline is a claim about the
pipeline as much as about the data — and this one would have converted a filing defect of
mine into a false accusation against the whole store.

Related, same store: single-line `grep` for phrases is wrap-width dependent here because atoms
hard-wrap mid-sentence; use `rg --multiline`.

## Reporting form

State such counts as **`≥N, own-session only`**, never as a bare ordinal. Every edge counts
privately, so any one agent's total is a floor; presenting "5 attempts" as though complete is
what invites the undercount. And the operator-actionable figure is the **rate** (dropped
decisions per hour of activity), not the count — a count grows silently with fleet size, while
a rate says how much signal is being lost per unit of work.
