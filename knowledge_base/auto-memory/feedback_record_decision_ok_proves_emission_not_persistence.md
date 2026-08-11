---
name: feedback_record_decision_ok_proves_emission_not_persistence
description: "record_decision returns ok('Decision recorded') with NO writer check in the handler — the gate runs out of band after the row is consumed. Success string proves EMISSION, never persistence; and the denial is asymmetric (silence ≠ success). APPROVAL_LEDGER_WRITERS unset ⇒ every approver decision fleet-wide is unpersisted"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8d73dcb6-6732-47d9-b20e-255818a8fc2b
---

# `record_decision` success ≠ a ledger row · **operator action outstanding**

**08-10, reported by slangpy-pr-approver, corroborated by me in host source.** The approver
told me on 08-03 *"Ledger row keyed `(shader-slang/slangpy, 1068, 266b2072e621…)`"*. **No such
row exists.** The host denied the write:
`record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`.

## Mechanism (two halves, two sources)

**Container half (approver's read, `/app/src/mcp-tools/core.ts:580-604`):** the handler
validates args, emits a `messages_out` row, and returns `ok('Decision recorded: …')` with
**no writer-capability check in it**. `APPROVAL_LEDGER_WRITERS` appears nowhere under `/app`.
⇒ the success string is an **emission receipt**, not a persistence receipt.

**Host half (MY read — see the caveat below):** `src/modules/approval-ledger/capability.ts`
`isApprovalLedgerWriter()` resolves `approvalLedgerWriters()` from
`process.env.APPROVAL_LEDGER_WRITERS || envConfig.APPROVAL_LEDGER_WRITERS`, split on commas.
Three branches, and **the denial text identifies which one fired**:

| branch | reason text | scope |
|---|---|---|
| `allowlist.length === 0` | `no approval-ledger writers are configured (set …)` | **environment-wide — denies EVERY group** |
| id/folder miss | `agent group <folder> does not hold the approval-ledger writer capability` | that one group |
| allow | — | — |

The observed message is branch 1 verbatim ⇒ **this confirms the approver's inference that the
fact is environment-level, not call-level.** Matching happens on **group id first, then
`groups.folder`** (case-insensitive), so the fix accepts either spelling. It's read through a
function, not captured at import, so **no host restart is needed** once set.

⚠️**CAVEAT ON MY OWN CITATION:** I read this in the clone at `/workspace/agent/pr1175/src/`,
**not** the running host. Same-name file, possibly different version — the exact trap in
ANCHOR A. Treat my `file:line` as corroborating the *shape* of the gate; the authoritative
statement about the live install is the denial string itself.

## Why it was easy to get wrong: the feedback is ASYMMETRIC

Two calls, identical args, same environment — **only the second was denied**:

| call | emitted | denial |
|---|---|---|
| seq=5 | `08-03T19:49:31.782Z` | **none, ever** |
| seq=19 | `08-10T11:28:51.840Z` | `11:28:53.119Z` (+1.3s) |

⇒ **silence on 08-03 was not success.** Same family as
[[feedback_exit_zero_empty_is_not_a_negative_result]] and the standing rule that a check's
*failure* must be distinguishable from its *negative result*. Reporting rule the approver
adopted and I endorse: **say "emitted", never "recorded"**, until a read-back confirms the row.

## 2nd instance, same day — the gate is not a one-off

**08-10T17:04:20Z, `shader-slang/slangpy#1097`** @ `9d502374c933…`: identical shape. Container
returned `"Decision recorded: …= ABSTAIN_POLICY"`; host denied with **branch-1 text verbatim**
(`no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`). The approver
reported it as **ATTEMPTED, pending operator action** and verified only what it could see
(`messages_out` seq 3, 6945 B, payload intact) — the reporting rule from this leaf, applied
correctly and unprompted, by a *different* session than the one that first hit it.
⇒ ⭐⭐**Two branch-1 denials the same day — `11:28:53Z` (#1068 re-attempt) and `17:04:20Z`
(#1097), different sessions, different repos-of-record: the denial is standing environment
state, not a transient.** ⚠️**Not "zero persistence between them" — I have NO reader for
`approval_decisions`** (no such `ncl` resource), so the between-state is *unmeasured by me*;
what is measured is two denials bracketing it. Escalated to the operator on `#1097` — the first
escalation carrying a **live-measured denial string** instead of my stored claim.
⚠️**I cannot fix this from my own edge** — my `ncl` surface has no `env` resource and no
`approval_decisions` reader (verified `ncl help`, 08-10), so "Main is admin" does **not** imply
Main can set this. **Host `.env` + operator only.**

## Instance count — **MEASURED, not accumulated** (08-10, on `slang#12437`)

The reporting approver called its hit *"the 3rd+ occurrence (also #823, #825)"*. **That
undercounts by 4×, and the undercount is structural: each approver session can only see its
own hits.** Live measurement, command named per ANCHOR G:

```
grep -rl "no approval-ledger writers are configured" /workspace/shared/learnings | wc -l   → 16
```

16 denial-bearing learning files ⇒ **≥12 distinct PRs across 3 repos and 3 agent groups**:
slangpy `#925 #1050 #1068 #1096 #1097` · slang-rhi `#821 #822 #823 #824 #825` · slang
`#12437 #12451`. (3 of the 16 files carry no extractable PR id; `#821` appears in two groups.
So 12 is a **floor**, and only counts hits somebody bothered to file a learning about.)

⇒ ⭐⭐⭐**A per-session occurrence count is a LOWER BOUND that reads as a total.** Every approver
reporting "3rd occurrence" is honest and wrong by the same mechanism — N sessions behind one
capability defect, each counting privately. The shared learnings dir is the only edge that can
see the union, and it is **mine**. Same family as ANCHOR E (attribution across N sessions behind
one destination name is a missing-key problem) — here the missing key is a fleet-wide counter.
⇒ **When a peer escalates with an occurrence ordinal, re-measure the union before relaying it
upstream; the ordinal is evidence of ITS history, not of the defect's size.**

⛔**MY OWN ORDINAL WAS ALSO WRONG — and I corrected an approver's before checking mine.** I
framed #1097 as the "2nd instance". The shared store's union: **≥16 distinct PRs across 3 repos
and 3 agent groups**, re-derived 19:45Z (slangpy `925 1050 1068 1096 1097 1098` · slang-rhi
`821-825` · slang `12437 12448 12450 12451 12452`) from **22** denial atoms. ⇒ ⭐⭐⭐**Every
edge counts privately, so every edge under-reports by the same mechanism — including the edge
that just corrected someone else for it.** My canonical union leaf shipped `≥12` at 18:16Z and
was stale by 4 PRs within ~90 min ⇒ ⭐⭐**a canonical leaf concentrates staleness where everyone
reads it; it does not stop it.** The operator figure is the **rate (~2-3 dropped decisions/hr of
approver activity)**, not the cumulative count. Re-derive, never re-quote:
`grep -rhoE "(slangpy|slang-rhi|slang)#[0-9]+" $(grep -rl "no approval-ledger writers are configured" /workspace/shared/learnings) | sort -u`

## 🔴 OPERATOR ACTION — MINE, still outstanding as of 08-10

`APPROVAL_LEDGER_WRITERS` is unset ⇒ **every decision every approver container has ever
emitted is unpersisted** — not just #1068, and not just slangpy. Shadow-mode accuracy scoring
has **no data at all**. Fix: set it to the approver group folders
(`slang-pr-approver,slangpy-pr-approver`); no restart needed. Until then, the only durable
records are the approvers' own `work/<pr>-<sha>/` dirs (`clauses.json`, `review/review-doc.md`).
**Do not read an empty `approval_decisions` table as "the approvers aren't deciding."**

Group-id ↔ folder resolution for the fix (`ncl groups list`, 08-10): `ag-1783611156430-vvj8oi`
= `slang-pr-approver`, `ag-1783611156448-d49n0a` = `slangpy-pr-approver`. Either spelling is
accepted by the matcher (id first, then folder, case-insensitive).

Also settled: **`record_human_verdict` is deliberately unregistered** (`core.ts:608-614`) — the
host stamps human outcomes from the webhook, keyed by delivery id. Container calls are denied
by design; routing join fields through `record_decision` as a workaround is wrong and is what
drew this denial. Consistent with the CLAUDE.md note that human verdicts come only from the
webhook path. Related: [[feedback_two_sets_same_count_different_members]] (same PR, my error).

## 3rd hit of 08-10 — `slangpy#1098` @ `15f687920306` · union RECOUNTED, and it GREW

**08-10T18:2x, slangpy-pr-approver, `ABSTAIN_POLICY`/`OPEN_GAP`.** Container returned
`Decision recorded: … = ABSTAIN_POLICY`; host denied with **branch-1 text verbatim**. The
approver reported it correctly as *"the ledger append did not persist… no row exists"* and named
the host's denial as authoritative over its own success string — this leaf's reporting rule
applied unprompted by a **third** session.

⚠️**I re-measured the union before relaying the ordinal (the rule this leaf already carries), and
the stored figure was stale in the direction that understates:**

```
grep -rl "no approval-ledger writers are configured" /workspace/shared/learnings | wc -l   → 20   (was 16)
```

⇒ **≥17 distinct PR ids** now: slangpy `#918 #925 #1002 #1050 #1068 #1096 #1097 #1098` ·
slang-rhi `#819 #821 #822 #823 #824 #825` · slang `#12437 #12448 #12451`. Three repos, three
agent groups, **still zero successful persistence.** ⭐⭐**A "floor" figure I wrote myself came
back as a ceiling 8h later** — the same trap as ANCHOR G: `16` was a measurement when written and
a stored conclusion when re-read. **Re-run the grep; never quote the last count.**

**Operator action UNCHANGED and still mine, now escalated with 3 same-day instances rather than
1.** `APPROVAL_LEDGER_WRITERS=slang-pr-approver,slangpy-pr-approver` (id or folder both accepted,
no restart). Verified again 08-10 on my own edge: `ncl help` exposes **no** `env` resource and
**no** `approval_decisions` reader ⇒ admin ≠ able to set this. Host `.env` + operator only.

## 4th hit of 08-10 — `slang#12448` @ `e87cb320422a` · **MY OWN RECIPE UNDERCOUNTS**

**`slang-pr-approver`, `ABSTAIN_POLICY`/`OPEN_GAP`, branch-1 text verbatim.** Fourth same-day
denial, third agent group, and the approver again reported it correctly and unprompted
(*"the success string is NOT the write"*) — the reporting rule in this leaf is now applied by
**four** sessions without being told.

⛔**The recipe I published two sections above is WRONG, and it is wrong in the direction that
under-reports.** It requires a repo prefix:

```
grep -rhoE "(slangpy|slang-rhi|slang)#[0-9]+" $(grep -rl "no approval-ledger writers …")   → 17 ids
grep -rhoE "#[0-9]{3,5}"                     $(same file set)                             → 20 ids
```

The delta is not noise. **`#819` is written BARE** in
`ag-1783611156430-vvj8oi/1786378436661-…md:20` (*"previously on #819, #823 ×2, #824"*) — a
genuine denial-bearing PR my own prefix regex drops silently. ⇒ ⭐⭐⭐**A recipe that requires a
prefix the source text does not guarantee returns a TRUE count of a set the reader never
chose.** Same class as the `head -40` truncation the approver caught in itself the same day, and
as ANCHOR G: the cap/filter lives *inside the command*, so the result carries no signal that it
narrowed.

⚠️**But the wide regex is ALSO wrong, in the other direction.** Its two extra ids `#918` /
`#1002` come from `ag-…-d49n0a/1786367856109-…md:36`, where they are **`record_human_verdict`
stamps** — a *different* tool with its own persistence problem (see the `record_human_verdict`
paragraph above), co-located in a denial-bearing file. ⇒ ⭐⭐⭐**File-level grep cannot attribute
an id to the denial; it can only prove co-occurrence.** Both regexes answer a question I did not
ask: A = "ids that carry a repo prefix", B = "ids appearing anywhere in a file that also
mentions the denial". Neither is "PRs whose ledger append was denied".

✅**Honest floor, stated with its method:** **18** distinct PRs (regex A's 17 + bare `#819`),
across 3 repos and 3 agent groups — slangpy `925 1050 1068 1096 1097 1098` · slang-rhi
`821 822 823 824 825` · slang `12136 12437 12448 12450 12451 12452` · plus `slang-rhi#819`.
`#918`/`#1002` excluded as a different tool. **Still zero successful persistence.** ⇒ **When
relaying this figure, name the regex AND its two failure directions** — the count without the
method is the same stored-conclusion trap this leaf keeps re-learning.

⚠️**Artifact retention is the second-order loss.** The approver's fallback file lands in
`/workspace/inbox/<a2a-id>/` — **an inbox path with no retention guarantee**, which is where the
only record of a 6-round decision now lives. I copied this one to
`/workspace/agent/approver-decisions/12448-e87cb320422a-decision.md` (13245 B). ⇒ ⭐⭐**Until the
env var is set, every approver decision's sole durable copy depends on a receiving tier
bothering to move it off the inbox** — and no check reports when one isn't moved.

## 5th hit of 08-10 — `slang#12452` @ `fe1feac57c06` · union re-measured AGAIN, grew AGAIN

**`slang-pr-approver`, `ABSTAIN_POLICY`/`OPEN_GAP`, branch-1 text.** Re-ran the recipe at
23:5xZ rather than quoting the section above (which said `24 files / 18 ids` was a floor):

```
grep -rl "no approval-ledger writers are configured" /workspace/shared/learnings | wc -l   → 24
grep -rhoE "(slangpy|slang-rhi|slang)#[0-9]+" <those files> | sort -u | wc -l              → 18
```

⇒ prefixed set is **18** ids (slangpy `925 1050 1068 1096 1097 1098` · slang-rhi
`819 821 822 823 824 825` · slang `12136 12437 12448 12450 12451 12452`), **plus** bare `#918`
/ `#1002` which are `record_human_verdict` stamps and stay excluded. The approver reported
"17 distinct PRs across 3 repos" — **honest and one low by its own private count**, the exact
lower-bound mechanism this leaf already documents. ⚠️Note the prefixed regex now *does* catch
`slang-rhi#819`, so the "17 + bare 819 = 18" correction above is **absorbed, not additive** —
re-deriving beat re-quoting in both directions.

## 6th hit — `slang#12455` @ `656583bb2adb` · **THIRD failure direction of my recipe: LINE WRAP**

**08-11T00:46Z, `slang-pr-approver`, and the first `BLOCK` in the series** — every prior dropped
decision was `ABSTAIN_POLICY`. ⭐⭐⭐**A dropped BLOCK is the one class that would have changed an
outcome under enforcement**, so the severity of this config defect is not uniform across its
instances and a cumulative count hides that.

⛔**My published recipe undercounts a THIRD way, and I found it only because a peer's number
disagreed with mine.** The approver reported 27 atoms / 21 ids against my 24 / 18, and I told it
*"I'd trust yours over mine"* — then measured instead of deferring (ANCHOR: deference discards a
correct measurement). Neither of us was simply right:

```
grep -rl "no approval-ledger writers are configured"                    → 24 files, 18 ids
rg -l --multiline --multiline-dotall "…writers\s+are\s+configured"      → 25 files, 19 ids  ← +#12455
```

The extra atom wraps the phrase across a newline (`…no approval-ledger writers are` /
`configured (set …)`, `…-vvj8oi/1786409670355-…md:12-13`). ⇒ ⭐⭐⭐**A single-line grep for a
prose phrase in prose atoms is a WRAP-WIDTH-DEPENDENT filter: the same event is findable or
invisible based on where a text editor broke the line.** Third direction alongside prefix-drop
and co-occurrence, and the one with no tell at all — the count looks stable *because* it is
consistently wrong. **Use `rg --multiline` for any phrase filter over authored prose.**
⚠️Also measured: `grep -rl APPROVAL_LEDGER_WRITERS` → 28 files, but 4 of those are *commentary*
about the var (sweeps, corrections, escalation notes), not denial events ⇒ the wider filter buys
recall at the cost of the co-occurrence error this leaf already documents. **19 prefixed ids is
the floor with its method named** (multiline phrase filter, prefixed-id regex).

✅**New, cheap, and better than the id count for the operator: the RATE, from atom mtimes.**
`for f in $FILES; do date -u -r "$f" +%Y-%m-%dT%H:%MZ; done | sort` → 13 atoms 15:09Z–23:02Z,
**but 2 of those are MINE** (`ag-1776713211742-1w6l4e`, the canonical-union and prefix-recipe
meta-notes) — ⚠️counting my own commentary as denial events would inflate the operator's figure,
the same self-inclusion bug as the watchdog's dead self-exclusion guard (ANCHOR F). Approver-
authored only: **11 atoms across the two approver groups (`…-vvj8oi`, `…-d49n0a`) in the 7.2 h
window 15:09Z → 22:22Z ⇒ ~1.5 dropped decisions/hour**, and a floor (one atom per session that
bothered to file; #12452's own 23:4xZ denial had no atom yet when measured). ⭐⭐**mtime gives a rate with
no id-attribution problem at all** — it sidesteps both failure directions of the id regexes
(prefix-drop and co-occurrence) because it counts *events*, not *ids*. Use the rate upstream;
the cumulative count is the figure that keeps going stale.

