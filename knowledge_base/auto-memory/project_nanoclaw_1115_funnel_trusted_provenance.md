---
name: project_nanoclaw_1115_funnel_trusted_provenance
description: "nanoclaw#1115 funnel provenance filter — reviewed INLINE (~28th routing instance), MERGED mid-review (9th race) despite body saying 'Not merging'; blob==nv-main BY HASH; 2🔴 both in the MIGRATION-DAY state the author's own 4-case table omits"
metadata: 
  node_type: memory
  type: project
  originSessionId: d3570ef8-73f9-438f-90c1-926ca68c8a00
---

# nanoclaw#1115 — `funnel: only count approval decisions with verified provenance`

szihs → `nv-main`, branch `fix/nv-main/funnel-trusted-provenance`, **1 file** (`scripts/funnel.ts`
+77/−31), head `4a35e149`. Companion to **#1110** (F14 approval-ledger capability guard + migration
934), opened at that PR author's request. Comment
[`5205438442`](https://github.com/slang-coworkers/nanoclaw/pull/1115#issuecomment-5205438442).

Reviewed **INLINE by Main** — ~28th instance of the standing rule
([[project_nanoclaw_pr874_webhook_route_approver]]): the `pr_ready_for_review` webhook carried the
generic *"route to the project's `*-pr-approver`"* string, overridden as always (nanoclaw-platform
fork, no nanoclaw approver wired; a slang/slangpy **compiler** approver at a funnel-metrics PR is
nonsensical). Verb-split write path held: `gh api …/issues/N/comments -X POST` works.

## 🔴 MERGED MID-REVIEW — 9th race in this series, and the body explicitly said "Not merging."

Merged `d183bcd8` at **13:36:06Z**, ~13 min after opening; I posted 13:43. ⭐⭐⭐**An author's stated
intent not to merge is not a gate — recheck `merged`/`state` IMMEDIATELY BEFORE POSTING regardless of
what the body promises.** Caught it on the pre-post recheck, so the comment leads with "review of the
merged tree, not a pre-merge gate" rather than filing findings under a false pre-merge banner.
✅**Merged blob == reviewed head BY HASH**: `scripts/funnel.ts` = `977efa33` at both `4a35e149` and
`nv-main` tip ⇒ every measurement still applies to `nv-main`. Merge commit has **1 parent**
(`a7d68ac1`) = squash, not a true merge. `ci` was `in_progress` at fetch and **green** by post time.
0 prior comments / 0 reviews / 0 inline (unlike #1104, no invisible-review problem here).

## What it does (design call is RIGHT)

Filters the funnel's `approval_decisions` read to `provenance = 'agent_verified'`. Deliberately NOT
the one-line `WHERE` that was requested, to stay order-independent of #1110: probes for the column
with `SELECT name FROM pragma_table_info(?)` first (a blind `WHERE provenance` throws on a pre-934 DB,
the pre-existing bare `catch {}` swallows it ⇒ silent empty panel), and an unmigrated DB keeps today's
behaviour **loudly** rather than silently switching population. Also replaces `catch {}` with a
logging catch, and adds `approverLedger.provenanceFiltered` to the snapshot.

✅**All four body states reproduce EXACTLY** — ran the block **verbatim** (funnel.ts:356-421 from the
head blob) against real `better-sqlite3` 3.49.2 at `/app/node_modules/better-sqlite3`, plus migration
934 lifted verbatim from #1110's head `8eb453c9`. Same `provenanceFiltered`, same PR sets, same log
strings. Both `PRAGMA table_info(x)` and `SELECT name FROM pragma_table_info(?)` **do** return `[]`
for a missing table (body claim, re-verified — the whole design rests on it).

## The two findings — both in the MIGRATION-DAY state the 4-case table omits

⭐⭐⭐**The author's case 3 fixture has two `agent_verified` rows, so filtering always leaves something
behind. But 934 backfills EVERY pre-existing row to `legacy`, and the guarded writer only starts
stamping after #1110 lands ⇒ there is a window where every row is `legacy` and the filter removes ALL
of them.** A fixture that pre-seeds the post-state cannot see the transition into it.

### 🔴 1. Migration day → confident empty scoreboard, and `provenanceFiltered: true` argues it's trustworthy

934 verbatim over 47 historical rows → `[{"provenance":"legacy","c":47}]` → shipped block returns
`rows:0`, `provenanceFiltered:true`, **`log:[]`** (no stderr at all). Three states are byte-identical
in the snapshot: 47 real legacy decisions / genuinely empty ledger / writer stamp drifted — all
`rows:0 + true + silent`. Through the real `nv-dashboard` `funnelApproverPanel`:
`WOULD_APPROVE 0 · BLOCK 0 · … — 0 PRs decided` + **"No approver decisions recorded yet."** — the
panel states as fact that nothing was recorded while 47 decisions sit in the table. Same filtered
list feeds `reviewCyclesHtml` ⇒ flips `bot 2 rounds / 12 reviewed / 100% coverage` → `no data / 0 / —`
on identical input (measured through the real `nv-main` `aggregateReviewCycles`, not inferred).

⭐⭐⭐**`provenanceFiltered: true` makes it WORSE, not better** — the field exists to caveat an
*unfiltered* number, so `true` is the reassuring value ("attributable decisions only"). On migration
day it is technically accurate and reads as an ENDORSEMENT of a zero meaning *everything was
excluded*. **The `false` branch got a loud warning + a snapshot field; the `true` branch, which has
the more misleading failure mode, got neither.** ⇒ same class as the `rc=0` cron the body itself
cites, and as [[project_nanoclaw_1104_dashboard_denominator_panels]]'s missing-cohort sentinel.

### 🔴 2. The comment promises the probe "fails loudly" on stamp drift; measured, it fails SILENTLY

Comment on `TRUSTED_PROVENANCE`: *"the probe below fails loudly, not silently, if this ever stops
matching what the writer stamps."* The probe checks the **column exists** — it cannot check the
**value**. Constructed the drift (934 applied, writer stamps `host_verified`, reader wants
`agent_verified`): `rows:0, log:[]` with **CONTROL (matching stamp) → `rows:5`** ⇒ the zero is a
property of the code, not a dead harness. ⭐⭐⭐**That sentence is the ENTIRE safety argument for
duplicating the literal instead of importing `TRUSTED_PROVENANCE` from `store.ts` — the local literal
is the right call (an import would be uncompilable until #1110 lands), but the thing making it safe in
the meantime does not exist.** Filter is an allow-list (verified: `forged-by-hand` excluded, not
passed through) ⇒ drift fails toward *exclude everything* = finding 1's shape.

### Candidate fix, swept across 5 states with the shipped block as control

`SELECT COUNT(*) … WHERE provenance <> ?` behind `if (provenanceFiltered)`, logging when >0:
47 legacy → `excluded:47` **logged** · genuinely empty → `excluded:0` · mixed 3/47 → `rows:3,
excluded:47` · read threw → `excluded:null, readFailed:true` · drift → `excluded:5`. **`0` vs `47` vs
`null` separates all three states the shipped version collapses**, closes finding 2 too, and costs one
`COUNT(*)` behind `idx_approval_decisions_provenance` — an index **934 already creates**.

## 🟡 stderr may not reach a human on the path that runs this

`funnel-cron.sh:37` does `"$@" >> "$LOG" 2>&1` (good — the `rc` capture from the earlier `rc=$?` fix
means real failures are visible), but `:75` trims to `tail -200` and the `false`-branch warning is a
`console.error` on an `rc=0` run logged `refresh ok`, competing with ~180 lines/run. `provenanceFiltered`
is the durable half and the right instinct — **0 consumers today**: `provenanceFiltered`/`approverLedger`
→ 0 hits in `dashboard/public/app.js` + `dashboard/server.ts` on BOTH `nv-main` and `nv-dashboard`;
**control `approverDecisions` → 2 hits** in `nv-dashboard`'s `app.js`. Additive and correctly flagged
to @team-lead, so not charged as a defect.

## ✅ Verified clean (so it isn't re-litigated)

Allow-list excludes `forged-by-hand` · `columns.length === 0` fires its own distinct message ⇒ the
probe genuinely separates "no ledger" from "unmigrated" · logging catch now only sees real failures
(malformed DB surfaces `no such column: pr_number` instead of vanishing) · `ASC + overwrite → last
wins` accurate — `store.ts` insert is `ON CONFLICT(repo,pr_number,commit_sha) DO NOTHING`, genuinely
append-only · NOT filtering `getDecisionSessionsForPr` (wake-the-session index) while filtering the
metric read is the right split, and #1110 says so explicitly · `prettier --check` RC=0 **read directly,
not through a pipe** ([[feedback_never_read_an_exit_status_through_a_pipe]] — first attempt read
`${PIPESTATUS[0]}` after a `tail`, re-ran clean) · true `git merge-base` == `baseRefOid` `e81a0cc7`,
two-dot and three-dot both 1 file · **reader census**: `scripts/funnel.ts` is the ONLY metric consumer
of `approval_decisions` outside the ledger module/migrations/tests on `nv-main` (`store.test.ts` 10,
`store.ts` 7, migration 929 5, `funnel.ts` 3, migration 931 2, `core.ts` 2, `index.ts` 1; control
`approverDecisions` → `funnel.ts`) ⇒ the PR covers the read side completely.

## Live risk: LOW right now, and that's the argument for ordering

**934 is NOT on `nv-main`** (migrations stop at 933; #1110 still OPEN at `8eb453c9`) ⇒ the live cron
takes the `false` branch = today's behaviour + warning. **Both findings become reachable the moment
#1110 merges, which is also the moment the ledger is all-`legacy`** ⇒ argued for landing the count
BEFORE #1110 rather than after.

## Method note

⭐⭐⭐**Neither finding is visible by reading** — both came from running the shipped block verbatim
against real `better-sqlite3` with migration 934 applied verbatim, then piping results through the
real producer aggregate and the real renderer extracted from the head blob with `new Function`. Fifth
consecutive nanoclaw PR where this holds (cf. #1068, #1076, #1078, #1104). Every probe paired with a
control that could return the other answer. Cf. [[feedback_control_the_instrument_not_the_reasoning]].

**RESUME** = szihs replies ⇒ offer the `excludedUnattributable` follow-up (~8 lines, already swept
against 5 states) + the comment correction. **Merged, so both findings are LIVE on `nv-main`** but
dormant until #1110 lands — **if #1110 merges, the migration-day window opens: re-check whether the
count landed first.** Author ships responsive commits within minutes on this series.
