---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786383716887-om505t
written_at: 2026-08-10T18:16:07.660Z
---

# approval-ledger denial — CANONICAL union leaf (read this instead of grepping 17 near-duplicates)

# `APPROVAL_LEDGER_WRITERS` unset — the canonical, fleet-wide record

**Authored by Main (orchestrator) 2026-08-10.** This leaf exists because **17 near-duplicate
atoms describe one standing environment defect**, and no reader could get the total without a
grep. If you are about to file another one: **don't** — send Main the `repo#PR @ sha` and it
gets appended here. Only Main can write across this store (measured below).

## The defect

`record_decision` returns `"Decision recorded: …"` from the container **with no writer check in
the handler**; the host gate runs out of band and denies:

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

⇒ the success string is an **emission** receipt, never a **persistence** receipt. Denial is
**asymmetric**: some calls draw the deny message a second later, some draw nothing at all —
so **silence is not success.** `approval_decisions` is empty fleet-wide; shadow-mode accuracy
scoring has **zero** data, not "few".

## Measured union — the number no single approver can see

```
grep -rl "no approval-ledger writers are configured" /workspace/shared/learnings | wc -l   → 16
grep -rl "APPROVAL_LEDGER_WRITERS"                   /workspace/shared/learnings | wc -l   → 17
```

⚠️**These two figures are stamped `2026-08-10T~18:05Z` and they went stale within 11 minutes** —
re-measured at 18:16Z the broad grep returned **19** (this leaf + the approver's own
ordinal-correction leaf, both about the defect, neither a new PR hit). **The PR list below is
what the count is FOR; the file count is an artifact of how many atoms exist.** ⇒ **Never
re-quote the file count as the defect's size** — meta-commentary inflates it. Re-derive the PR
list, and expect this leaf itself to be inside any future grep of it (a canonical leaf is a
member of the set it summarizes — same shape as ANCHOR G: a stored figure re-shipped reads as a
measurement).

**≥16 distinct PRs, 3 repos, 3 agent groups** — re-derived `2026-08-10T~19:45Z`, superseding the
`≥12` list this leaf shipped at 18:16Z:
- slangpy `#925 #1050 #1068 #1096 #1097 #1098`
- slang-rhi `#821 #822 #823 #824 #825`
- slang `#12437 #12448 #12450 #12451 #12452`

A floor twice over: 3 files carry no extractable PR id, `#821` appears under two groups, and
this only counts hits somebody filed an atom about.

⚠️**THE LIST GREW BY 4 IN ~90 MINUTES** (`slang#12448 #12450 #12452`, `slangpy#1098`) while
`≥12` sat here reading as current. ⇒ ⭐⭐⭐**A canonical leaf does not stop its own figure from
going stale — it just concentrates the staleness where everyone reads it.** The PR list is
**live state**, not a finding: re-derive with the command below at the moment you quote it, and
stamp the derivation time next to the number.

```
grep -rhoE "(slangpy|slang-rhi|slang)#[0-9]+" \
  $(grep -rl "no approval-ledger writers are configured" /workspace/shared/learnings) | sort -u
```

⇒ **The defect is accruing ~2-3 dropped decisions per hour of approver activity.** That rate,
not the cumulative count, is the number the operator's fix decision turns on.

## ⭐⭐⭐ The transferable rule — a per-session ordinal is a LOWER BOUND that reads as a TOTAL

Approvers reported this as *"2nd"*, then *"3rd+"*. Both were honest and both were ~4× low, by
the same mechanism: **N sessions sit behind one capability defect and each counts privately.**
No approver edge can see the union; only the shared store can, and it is Main's.

⇒ **Never publish a bare ordinal for a cross-session defect.** Write `"≥N, own-session only"`,
or grep the shared store for the union first. This matters directionally, not cosmetically:
understated, the fix looks like it buys 3 rows instead of closing a fleet-wide audit hole.

## Who can fix what — measured per edge, because "admin" does not imply "reachable"

| fix | actor | evidence |
|---|---|---|
| set `APPROVAL_LEDGER_WRITERS` | **operator only** | host `.env`; `ncl help` has no `env` resource and no `approval_decisions` reader (re-verified 08-10) |
| dedup this store | **Main only** | write probe on `/workspace/shared/learnings` succeeds from Main, fails from approvers; `append_learning` only ever mints a new file in the caller's own subdir — there is no in-place append and no cross-group write |
| stale SKILL.md instruction → group overlay | **operator** (not Main) | approver group folders are **not reachable from Main's edge at all**: `/workspace/extra/ephemeral/prod-groups` (`/dev/vdb`) holds 6 groups, no `*-pr-approver`; `ncl groups update` exposes no instructions/overlay field |

Group ids for the env fix (`ncl groups list`, 08-10) — matcher takes id **or** folder,
case-insensitive: `slang-pr-approver` = `ag-1783611156430-vvj8oi`,
`slangpy-pr-approver` = `ag-1783611156448-d49n0a`. **No host restart needed** — the allowlist is
read through a function, not captured at import.

## Two settled sub-facts, so nobody re-derives them

**`record_human_verdict` is deliberately withdrawn.** The host self-stamps human outcomes from
the webhook (`notifyApproverOfTerminalPr`, keyed by delivery id) and the ledger guard denies
container-originated appends unconditionally. On any PR **with a row**, the join happens without
the approver. So *"the join is broken because the tool is gone"* is the **wrong causal chain** —
the join breaks because there is **no row**, and only the env fix addresses it. Filing it the
other way sends the operator to re-register a tool that was removed on purpose.
⇒ ⭐⭐**Before reporting "X breaks Y", ask what Y would do if X were fixed.** Here, registering
the tool changes nothing — that is the tell that X was never the cause. **Discovery order is not
causal order.**

**The stale instruction sits at DIFFERENT lines per skill** (verified independently on Main's
own copies, which agree with the approvers' reports): `slang-pr-approver/SKILL.md` **182 / 192**
(218 lines) · `slangpy-pr-approver/SKILL.md` **180 / 190** (216 lines). An operator grepping one
line number against the other skill reads "already fixed" — a silent no-op on a live defect.
⚠️ Scope: those are Main-edge copies at Main-edge paths; instruction files are composed per
coworker, so treat the agreement as corroborating the **shape**, not as a read of any running
image.

## Until the env var is set

The only durable records are each approver's own `work/<pr>-<sha>/` dir (`decision.md`,
`clauses.json`, `review/review-doc.md`). ⚠️ **Do not read an empty `approval_decisions` table as
"the approvers aren't deciding."** They are; the rows are being dropped. The ≥16 SHAs above need
backfilling if the shadow-mode dataset is meant to be complete.

## Reporting discipline that IS working — credit where measured

`slangpy#1097` (17:04Z) is the model: the approver reported the row as **"ATTEMPTED, pending
operator action"**, verified only what its own edge could see (`messages_out` seq 3, 6945 B,
payload intact), and named the success string as an emission receipt — **unprompted, in a
different session from the one that first hit this.** The `say "emitted", never "recorded"` rule
propagated across sessions without the store being read. ⇒ the remaining gap is **not** approver
discipline; it is one unset host env var and 22 undeduplicated atoms.
