---
name: project_nanoclaw_1096_funnel_review_cycles
description: "nanoclaw#1096 funnel reviewCycles metric — reviewed INLINE (not routed), green/CLEAN, comment 5200859362; 6 notes incl. dual bot-login gap + CHANGES_REQUESTED extinct (meanRounds 0.035, 96.5% zeros)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3c8394f8-8141-44a7-ab38-c6916d80bab6
---

**slang-coworkers/nanoclaw#1096** — `funnel: measure human review cost alongside throughput`, branch
`funnel-review-cycles` → **`nv-main`**, author **szihs** (human/maintainer), **+83/-0, 2 files**
(`scripts/funnel.ts` +70, `scripts/funnel-cron.sh` +13). Head `b4f65e405aa16c8b457ed00c413c01bd511d2785`.

`pr_ready_for_review` webhook (reason `opened`) carried the generic post-#874 *"Route it to the
project's `*-pr-approver` (never a reviewer/fixer)"* task string — **standing rule overrides**:
NanoClaw-platform fork, no nanoclaw approver wired; a slang/slangpy COMPILER approver at a
nanoclaw-repo funnel-metrics PR is nonsensical. **Reviewed INLINE by Main, NOT routed.**

**Final state:** `check`✓ `ci`✓ (2m12s) `label`✓ — **all green**, `mergeStateStatus: CLEAN`,
`mergeable: MERGEABLE`, not draft, 0 reviews, OPEN. Merge is szihs's (`nv-main` outside the
[[feedback_nv_coworkers_automerge]] grant). **COMMENTED** — 6 substantive notes, none blocking:
`issues/1096/comments` id **5200859362** (verb-split write path held: `gh api … -X POST` works).

## The six findings (all measured, not inferred)

1. 🔴**DUAL BOT LOGIN — `isBotLogin('nv-slang-bot')` → `false`, executed.** The fork's own bot
   reviews under BOTH `nv-slang-bot[bot]` (`type=Bot`) and bare **`nv-slang-bot` (`type=User`)**.
   200-PR slang window on the **raw REST endpoint funnel.ts curls**: 192 suffixed vs **30 bare**
   rows (#12122 alone: 10 vs 3). Impact today small (1 of 141 PRs flips unreviewed→reviewed; all 30
   bare rows are `COMMENTED` so `meanRounds` unaffected) but inflates `coveragePct` and corrupts
   `meanRounds` on the bot's first `CHANGES_REQUESTED`. ⭐**The `EXTRA_BOT_LOGINS` set clause is
   UNREACHABLE for suffixed logins** (`endsWith('[bot]')` short-circuits) ⇒ the set only ever fires
   on a bare login, i.e. exactly this case — mechanism already right, needs `'nv-slang-bot'` added.
2. 🔴**`CHANGES_REQUESTED` is NEARLY EXTINCT ⇒ `meanRounds` reads ≈0.** 200-PR window, 1329 review
   rows: **1178 COMMENTED / 115 APPROVED / 31 DISMISSED / 5 CHANGES_REQUESTED**. Simulated metric:
   141 reviewed PRs, **meanRounds = 0.035**, **96.5% of reviewed PRs score exactly 0**. #12086 has
   **48** human review submissions → `humanReviewRounds = 0`; #12125→45, #12031→33. **Trap #1 in a
   shape the PR doc doesn't cover:** zero-*reviewer* PRs correctly excluded, but a 48-round
   `COMMENTED` slog also scores 0 *inside* the reviewed bucket. Denominator honest, numerator
   undercounts ~99%.
3. **`rc=$?` always prints 0** — pre-existing, faithfully copied into the new block. Local repro w/
   control pair: `echo "[$(date …)] FAILED (rc=$?)"` → **rc=0** (the `$(date)` substitution
   overwrites `$?`); same line without the substitution → **rc=42**.
4. **New python3 line needs `reports/` to pre-exist; only step ORDERING saves it.** `reports/` absent
   from the git tree at head (recursive walk, 1109 entries, 0 `^reports` hits; control
   `container/Dockerfile` found) and not gitignored. `regression-quality.py` does `open(a.json,"w")`
   with **zero** `makedirs` in 150 lines. `funnel.ts:777` DOES `mkdirSync(…, {recursive:true})` ⇒
   funnel line self-heals, python line doesn't; funnel runs first in the same script and creates the
   dir. Uncaught `FileNotFoundError` would log as `rc=0` per (3).
5. **The python3-provisioning comment points at files NOT on this branch.** `Dockerfile.derived` /
   `build-derived.sh` = **0 hits** on head AND `nv-main` (controls pass on both); they live only on
   `feat/nv-main/derived-hardened-image` = **#1084, still OPEN** against `nv-main`. Also
   `funnel-cron.sh` runs from `/home/ubuntu/slang-coworkers-prod/nanoclaw`, `HOME=/home/ubuntu`, via
   **system crontab — host-side, not in the agent container** ⇒ the hardened-image python3 story may
   not bear on this line at all.
6. 🔴**The reviews call can NEVER warm its cache — `per_page=100` CONTAINS the substring `page=`.**
   `diskCacheTtl`'s first check is `apiPath.includes('page=') → TTL_SHORT`. Executed:
   `'pulls/12/reviews?per_page=100'.includes('page=')` → **`true`** ⇒ every reviews call pins to
   **TTL_SHORT (15m)**, never reaching the terminal-state `TTL_LONG` that `pulls/N` gets.
   Contradicts the PR's *"warm disk cache makes this nearly free"*: one fresh call per decided PR per
   run >15min apart. Architectural call still stands (≫ better than ~400); the **cost claim** is off.

## Instrument lessons from this review

⛔⭐⭐⭐**`search/code` is UNINDEXED on this repo and returns `total_count: 0` for files that
demonstrably exist** — `filename:funnel.ts` → **0** while I had just read that file at that head;
`filename:Dockerfile` → **0** with the file present in the tree. **Two of my six findings were
absence claims** and I nearly grounded them on this. ⇒ **Use the authoritative recursive git-tree
walk (`git/trees/<ref>?recursive=1`) with a must-hit positive control; never let `search/code`
carry an absence claim.** Cf. [[feedback_audit_grep_false_negatives_asymmetric]].

⛔⭐⭐⭐**WINDOWED ZERO caught in-flight.** My first census (60 nanoclaw PRs) returned **0 review
rows**, and a 80-PR slang census returned **0 CHANGES_REQUESTED**. Neither was an instrument defect:
the control PRs that *do* carry `CHANGES_REQUESTED` (#11709, #11135, #12131, #12186, #12089) were
**all outside the window** (census range 12231–12379; every control `in-window-list: 0`). The
identical jq surfaced them when pointed at the right PRs. ⇒ **Before publishing a zero, print the
window bounds and check whether your positive control is INSIDE it** — a windowed zero and a broken
instrument look identical, and the fix is different (widen the sample vs fix the probe). Widening to
200 PRs turned "0 CHANGES_REQUESTED" into "5 — a 0.4% rate", which is the finding.

⭐⭐**`gh` CLI normalization vs raw REST:** the bare-`nv-slang-bot` finding is load-bearing, so I
re-verified it on the **raw REST endpoint funnel.ts actually curls** rather than the `gh pr list`
view — both agreed here, but the check is what makes the claim quotable.

⚠️**NOT VERIFIED, and hedged in the published comment:** `GET /users/nv-slang-bot` returned **401**
(`app_not_connected` — OneCLI GitHub not connected for that endpoint), so "the bare login is the
same non-human actor" rests on the login string + `type=User` + empty review bodies, **not** on the
account record. Per [[feedback_published_negative_env_claims_need_rederivation]] the comment states
the gap explicitly rather than asserting identity.

## `synchronize` #1 (2026-08-06, 20 min after my review) — head `1885f5354fba64c46f34fda5f7cf895f4216e8ad`

Scope **2 files/+83 → 4 files/+386**; NEW `scripts/funnel-metrics.ts` (+136, pure logic extracted) +
`scripts/funnel-metrics.test.ts` (+203, 20 fixture tests), `funnel.ts` +18/-54, `funnel-cron.sh` +2/-2.
szihs replied (comment **5201000202**) then I re-reviewed (comment **5201032189**). `check`✓,
`ci` pending at review time, `mergeStateStatus: UNSTABLE` (from pending ci), OPEN, 0 formal reviews.

🔴⭐⭐⭐**HIS REPLY CREDITS FIVE FINDINGS THAT ARE NOT MINE.** *"Thanks — all five were valid"* then
enumerates: (1) `prState` fetched-but-unused, (2) `authoredByBot===null` bare `continue`, (3) no
pagination, (4) cron comment, (5) no tests. **Only (4) maps to anything I raised.** My six were:
dual bot login, `CHANGES_REQUESTED` extinct, `rc=$?`, `reports/` mkdir, python3-provisioning note,
`per_page` cache defeat. ✅**EXHAUSTIVELY EXCLUDED a second reviewer** before flagging it: issue
comments **2** (mine + his), formal reviews **0**, inline PR comments **0**, commit comments **0**,
timeline = exactly `2 committed / 1 commented szihs / 1 commented nv-slang-bot`, and no sibling
funnel PR from today (`--search funnel`, 12 rows, next-newest is #986 from 07-19). ⇒ Those five came
from a pass never posted to this PR. ⭐⭐**I said so rather than accept the credit** — accepting it
would have let him believe my findings were addressed when 3 of 6 are untouched.

**Untouched at this head (verified against the new code, not the prose):**
- **My #1** — `funnel-metrics.ts:14` carries `EXTRA_BOT_LOGINS` forward **verbatim**; still no
  `'nv-slang-bot'`. Executed against the new module: `isBotLogin('nv-slang-bot')` → **`false`**.
- **My #2** — `funnel-metrics.ts:48` still counts only `CHANGES_REQUESTED`. Re-derived: meanRounds
  **0.036**, zero-share **96.4%**. ⭐**Interacts with his pagination fix in the WRONG direction:**
  #12080 truly has **187** submissions and *still* scores 0 ⇒ correct fetching makes the undercount
  MORE visible, not smaller.
- **My #6** — **pagination made it structural.** New call site builds
  `reviews?per_page=100&page=${page}` ⇒ now contains `page=` **twice**; `diskCacheTtl:162` tests
  `includes('page=')` first. Executed: both page-1 and page-2 paths → `TTL_SHORT`, never `TTL_LONG`.
- My #3 (`rc=$?`) and #4 (`regression-quality.py` still **0** `makedirs`) also stand, both minor.

**His fixes I DID verify by execution:** `fetchAllReviewsWith` against #12080's real (100, 87) shape
→ **187** ✓; first-page failure → `null` (unknown≠zero) ✓; page-2 failure keeps 100 partial ✓; cap
fires `onCap` with 1000 rather than truncating silently ✓. `notMergedExcluded`/`unclassifiedPrs`
split is the right call. Flagged that merged-only is a *third* denominator ⇒ the dashboard PR must
surface `notMergedExcluded` for `coveragePct` to be readable.

## ⛔ HIS FINDING #3 CAUGHT A BUG IN MY OWN REVIEW INSTRUMENT

⭐⭐⭐**My census used bare `per_page=100` — the exact defect he reported in the PR — and #12080 came
back at EXACTLY 100 rows, the truncation boundary.** Paginated re-fetch: **187 real rows, 87 hidden**
(page1=100, page2=87). ✅**I re-derived my published figures BEFORE replying**: the 87 hidden rows are
all `COMMENTED`, so meanRounds 0.035→**0.036**, zero-share 96.5%→**96.4%**, and #12080's
human-submission count rises 26→~110 (all scoring 0 rounds) ⇒ **conclusion held and STRENGTHENED**.
But it held **by luck of content**: one hidden `CHANGES_REQUESTED` would have made my headline number
wrong for precisely the reason I was criticizing his code. ⇒ ⭐⭐⭐**A round number at a page boundary
(`==100`, `==50`, `==30`) is a TRUNCATION SIGNAL, never a measurement** — `awk '{c[$1]++} END{...
if(c[p]>=100)}'` over the census is the one-line check, and it costs nothing. **I ran it only because
he named pagination**; nothing in my own method would have surfaced it. Cf.
[[feedback_a_tools_output_set_is_scoped_to_the_tools_question]] and the
complete-total-beside-a-truncated-list rule in `MEMORY.md`.
⭐⭐**And I disclosed it in the published comment** rather than silently correcting — the corrected
figures are cheap; the credibility of un-flagged self-correction is not.

## RESUME

No-op unless (a) a substantive human reply lands on comment 5201032189 — **especially any response to
the five-findings mismatch, which is the open question**, (b) another `synchronize` — then re-check
my #1/#2/#6 (all three are one-line greps: `EXTRA_BOT_LOGINS` for `nv-slang-bot`,
`funnel-metrics.ts:48` for `COMMENTED`, `diskCacheTtl` vs the `page=` substring), or (c) `ci` reports
RED (it was PENDING at my re-review ⇒ **no build verdict claimed** for this head per
[[feedback_never_relay_a_verdict_not_in_hand]]). Merge is szihs's;
CLEAN + green does **not** convert this into an auto-merge candidate. If #1084 lands, finding (5)
resolves itself.
