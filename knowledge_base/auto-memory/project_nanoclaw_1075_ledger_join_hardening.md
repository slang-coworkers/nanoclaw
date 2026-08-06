---
name: project_nanoclaw_1075_ledger_join_hardening
description: "slang-coworkers/nanoclaw#1075 approval-ledger join hardening — reviewed POST-MERGE inline (merged 8.5min after opening, 4th merge race); found the new exact-path guard RELOCATES the write onto a superseded decision row, plus one overstated PR-body ordering claim"
metadata:
  node_type: memory
  type: project
  originSessionId: ca1edafd-e960-46d0-b8b2-997dd63312b9
---

# nanoclaw#1075 — `fix(approval-ledger): first verdict wins, order by datetime, record join_mode`

author **szihs**, base **`nv-main`**, head `b3bcd59f59203a77a7e4a3cf72b85f09ceae7627`,
7 files +228 −57. **MERGED `2026-08-05T07:02:07Z`, 8.5 min after opening (06:53:38Z).**
Follow-up to #1069 (addresses its 3 review findings). Comment posted:
[`5188648524`](https://github.com/slang-coworkers/nanoclaw/pull/1075#issuecomment-5188648524).

⚠️**ROUTING: the `pr_ready_for_review` webhook carried the generic post-#874 task string
"Route it to the project's *-pr-approver coworker (never a reviewer/fixer)" — standing rule
OVERRODE it**, same as #1050/#1071/#1072: nanoclaw is the platform repo, no nanoclaw approver is
wired, and a slang/slangpy COMPILER approver on a nanoclaw PR is nonsensical. Handled INLINE by
Main. See [[project_nanoclaw_pr874_webhook_route_approver]] and
[[slang-nanoclaw-chains-index]].

## 🔴 The finding — a guard that RELOCATES the write instead of stopping it

The PR adds `AND human_verdict IS NULL` to the **exact** `UPDATE` in
`recordHumanVerdict` (`src/modules/approval-ledger/store.ts`). Correct in isolation, but it makes
`res.changes === 0` **overloaded**: it now means *"no such commit"* OR *"that commit is already
stamped"*. Only the first should fall through to the `head_advanced` branch. Because both do, a
second verdict event on an already-stamped head stamps a **different, older** decision row.

Reproduced by porting the merged function verbatim against 929's DDL (two revision decisions,
`AAA`@10:00Z + `BBB`@12:00Z, `BBB` = head):

```
ev1  CHANGES_REQUESTED @ BBB  -> exact          (correct)
ev2  MERGED            @ BBB  -> head_advanced -> stamps AAA   ← WRONG ROW
    AAA  WOULD_APPROVE  MERGED             head_advanced
    BBB  WOULD_APPROVE  CHANGES_REQUESTED  exact
```

⭐⭐⭐**The pre-PR bug was an OVERWRITE; the post-PR bug is a RELOCATION — the write did not stop,
it moved.** And it lands on a superseded `WOULD_APPROVE`, recording it as **agreement with a
merge** — precisely the over-credit `join_mode` was added in this very PR to DETECT. ⇒ the join
now manufactures the bias its own new tripwire measures, so `head_advanced` gets polluted with
rows that are not real head-advances.

⛔**Why the tests are green: every exact-path fixture holds ONE decision, so the fall-through has
no row to land on.** The new `does not overwrite on the EXACT path either` test asserts `false`
and that `CHANGES_REQUESTED` survives — **both remain TRUE under the bug**; the damage is on the
*other* row, which the fixture does not contain. ⭐⭐⭐**A test can assert exactly the right
invariant and still miss the defect when its fixture cannot express the failing shape — the
assertion was right, the FIXTURE was too small.** Repro = add a second `upsertDecision`.

Reachable: `record_human_verdict` is a per-event delivery action (`index.ts:73`) with **no
dedup**, and the PR body's own model (reviewer requests changes, then merges) IS a two-event
sequence. Suggested fix: probe for the exact row and return `false` when it exists but is stamped.

## 🟡 One PR-body claim overstated — `datetime()` truncates sub-seconds

PR body case 2 (`…12:00:00.500Z` vs `…12:00:00Z`) **does not hold**: `datetime()` returns whole
seconds (verified, sqlite 3.40.1), so both collapse to `12:00:00` and `rowid DESC` decides by
INSERTION ORDER — `.500` first ⇒ still picks the wrong row; `.500` last ⇒ right by luck.
Case 1 (offset form `…14:00:00+02:00` = 12:00Z sorting above `12:30:00Z`) and case 3 (exact tie)
**DO hold — verified in BOTH insertion orders**, so the change is a real improvement and the
shipped ordering test is sound. ⭐⭐**Only one row of a 3-row evidence table was wrong; testing
all three in both orders is what separated the real fix from the overstated claim.** Bonus
un-credited gain: unparseable `decided_at` → `NULL` now sorts LAST, not first.

## Notes filed

- **`funnel.ts:370` is a FOURTH spelling of "latest"** (`sort((a,b) => a.decidedAt < b.decidedAt ? 1 : -1)`,
  raw text) — not aligned though the PR aligned the other two. Display-only, but puts the
  offset-form row above the genuinely-newest.
- **Migration 931 is correctly AUTO-DISCOVERED** — `src/db/migrations/index.ts` scans
  `<version>-<slug>.{ts,js}`, so no central registry edit (that is by design, to keep the
  registry out of the nv-branch merge path). Its `if (!cols.length) return` early-out **still
  records `schema_version`** ⇒ if it ever ran before 929 the column is permanently skipped.
  Unreachable today (929<931, both dependency-free) but `dependsOn: ['approval-decisions']`
  would pin it, matching 924/925/927.
- **~90 of 101 added `funnel.ts` lines are prettier-only churn** vs `printWidth: 120`; CI runs
  `format:check` ⇒ pre-existing drift, now corrected. Buries the 1-line `ORDER BY` change.

## ⭐⭐ Merge-race count is now FOUR for szihs + `nv-main`

#1066 (−26s), #1068 (+104s), #1071 (mid-session), **#1075 (+8.5min)**. ⇒ **post-merge review is
the DEFAULT posture here, confirmed again: recheck `merged`/`state` BEFORE drafting, and verify
the merged blob equals the reviewed head BY HASH.** Done here — all **7** blobs matched `nv-main`
by blob SHA, so the review provably applies to the merged tree. CI green on the merged head
(`check`/`ci`/`label` all success). ⭐**Checking merge state at the START would have been useless
— it was `open`/`mergeable` then; the race closed DURING review, so the recheck must be
immediately before posting.**

**RESUME** = szihs replies ⇒ follow-up PR for the relocation defect (finding #1 is a live
regression on `nv-main`, same posture as #1066's still-live `superseded_by` defect).

## Second webhook (identical payload) — dropped, sha-verified

A byte-identical `pr_ready_for_review (reason: opened)` arrived after the review posted. Applied
the dispatcher-tier rule from [[feedback_debounce_approver_dispatch_deterministic_abstain]]
(`GET pulls/{n}` → `head.sha`, state the sha, never the inference): head still
`b3bcd59f`, still `merged_at 07:02:07Z` ⇒ **genuine redelivery, dropped.** Inbound scan run too
(debounce the re-run, never the scan): `issues/1075/comments` = my own bot comment only,
`pulls/1075/reviews` = **empty**. No human inbound ⇒ nothing to re-engage.
⭐⭐**`updated_at` HAD advanced (07:02:10Z → 07:05:11Z) and that is the trap — the mover was MY
OWN comment.** A freshening timestamp reads as external activity; subtract your own writes before
treating it as one. ⇒ **the discriminator is `head.sha` + a comment-author check, never
`updated_at`.**
