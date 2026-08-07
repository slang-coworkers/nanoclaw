---
name: project_nanoclaw_1106_funnel_feedback_session
description: "nanoclaw#1106 funnel feedback-session metric (follow-up to my own #1096 findings) — reviewed INLINE, MERGED +21min, blobs==merge commit BY HASH; comment 5205856282; 1🔴 DISMISSED erases CHANGES_REQUESTED + 3🟡"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5c8f0a9e-d818-458b-a60e-5021cca42498
---

**slang-coworkers/nanoclaw#1106** — `funnel: price review cost by feedback session, not
CHANGES_REQUESTED`, branch `fix/nv-main/funnel-review-cost` → **`nv-main`**, author **szihs**
(human/maintainer), **+536/−108, 4 files** (`funnel-metrics.ts` +186, `funnel-metrics.test.ts` +315,
`funnel.ts` +84, `funnel-cron.sh` +59). Head `b6451b86425a768a7badc57932f0904b792eec31`.

**Direct producer-side follow-up to my own [[project_nanoclaw_1096_funnel_review_cycles]]** — it
fixes exactly my findings #1 (bare `nv-slang-bot` billed as human), #2 (`CHANGES_REQUESTED`
extinct ⇒ `meanRounds` ≈ 0), #3 (`rc=$?` always 0), #4 (`reports/` mkdir), #6 (`per_page=100`
contains the substring `page=` ⇒ reviews never long-cached).

`pr_ready_for_review` webhook carried the generic post-#874 *"route to `*-pr-approver`"* task
string — **standing rule overrides: nanoclaw PRs are reviewed INLINE by Main**, never routed to a
slang/slangpy compiler approver. Verb-split write path held (`gh api … issues/1106/comments -X POST`).

**MERGED 13:19:35Z, ~21 min after opening** (merge-race count keeps climbing on szihs/`nv-main`);
merged_by szihs, merge commit `55bd2305`. **All 4 blobs at `55bd2305` == reviewed head BY HASH.**
⭐⭐`origin/nv-main` tip already had `funnel.ts` DIFFERING (blob `977efa33` vs head `5356fffa`) —
that is **#1115 landing after**, not a faithfulness problem: `git diff 55bd2305 origin/nv-main` on
`funnel-metrics.ts` + `funnel-cron.sh` = **0 lines** ⇒ *compare against the MERGE COMMIT, not the
branch tip, or a later sibling PR reads as an unfaithful merge.* CI all green (`check`/`ci`/`label`).
Comment **5205856282**. No formal review (verb-split gate).

## Verification that the four fixes work (all by execution + negative control)

Suite **47/47** using vitest 4.1.4 **borrowed via `ln -s /workspace/agent/nanoclaw-kb/node_modules`**
(no `node_modules` in a fresh clone; the borrowed tree's own repo is on `kb-wiki-fold-20260806`).
**Six impl-mutation controls prove non-inertness** — drop `'nv-slang-bot'`→3 fail · restore
`includes('page=')`→2 · `FEEDBACK_STATES` back to CR-only→8 · `SESSION_GAP_MS=0`→1 · re-emit
`&page=1`→1 · strip `normaliseLogin` trim/lowercase→3. Restored → 47/47.

"20 fixtures preserved, none weakened" is **exact**: all 20 base `it()` names present at head
(`comm -23` = empty), 0 dropped, 4 gained an assertion, **0 lost one**.

`run_step` executed directly: rc **42 / 0 / 1 / 127** all logged correctly, script exit **1**;
old spelling reproduces `rc=0` as the control. `bash -n` clean. ⭐The nonzero exit is load-bearing
beyond cron: dashboard `startFunnelRefresh` reads `exec` err → `lastError` → app.js *"refresh
failed — see logs/funnel-cron.log"*; previously the script always exited 0 via the trailing `mv`,
so a failed funnel silently rendered as success and reloaded stale data.

**Producer/consumer coordinated end-to-end** — post-merge `nv-main` emits `meanFeedbackRounds`
(3 refs) and `nv-dashboard` `dashboard/public/app.js` reads it (2 refs, plus `meanChangesRequested`,
`roundDefinition`, `sessionGapMinutes`). #1104 (`kb-quality-panels` → `nv-dashboard`) merged
13:20:09Z, **34 s after this one** — the rename did not strand the dashboard.

## The census (the instrument for everything below)

200 slang PRs, **fully paginated** — 1,388 review rows, 159 PRs with reviews. ⭐Ran the
truncation check first (`awk '{c[$1]++} END{if(c[p]>=100)}'`): exactly one suspect, **12080 at 214
rows**, correctly fetched across pages. State split **1241 COMMENTED / 114 APPROVED / 28 DISMISSED
/ 5 CHANGES_REQUESTED**. Bare `nv-slang-bot` **17** rows vs suffixed **255**, all bare ones
`type=User`, all `COMMENTED`.

Merged-only cohort through the shipped module: **bot** reviewed 60 / unrev 0 / cov 100% /
meanFeedback **1.00** / meanCR 0.02 · **human** reviewed 40 / unrev 28 / cov 59% / meanFeedback
**0.30** / meanCR 0.00. Overall 0.01 → **0.72** (96 real submissions vs 5). The bare-bot fix moves
9 PRs and pushes the bot mean **DOWN** 1.18→1.00 (it stops billing our own bot as human), i.e. the
fix corrects in the un-flattering direction.

## The four findings

1. 🔴⭐⭐⭐ **A `DISMISSED` review ERASES the `CHANGES_REQUESTED` it used to be, and the erasure is
   bot-favouring.** GitHub rewrites `state` in place; the original verdict survives only in
   `timeline → review_dismissed.dismissed_review.state`. Census: **28 dismissed, 2 originally
   `changes_requested`** ⇒ the strict subset sees **5 of 7** real CR events (**29% undercount**) —
   in the metric kept *specifically* to be conservative. Worse in the feedback metric: PR **12043**
   (bot-authored, merged) reads `reviewers=3, feedbackRounds=0, changesRequestedRounds=0` =
   **REVIEWED AT ZERO COST** where `jkwak-work` requested changes then dismissed after the fix.
   Direction: 15 of 26 approved-dismissals + the one merged CR-dismissal are all on bot PRs.
   The code comment *"DISMISSED/PENDING are not submitted feedback at all"* is true of `PENDING`,
   **false of `DISMISSED`** — submitted, then retracted. ⭐⭐**The characterising test PASSES, which
   is the problem** — a green fixture describing the bug.
2. 🟡 **The subset invariant the artifact asserts holds only when nothing collapses.**
   `feedbackRounds` is collapsed per reviewer; `changesRequestedRounds` is a raw `.length`.
   Executed — 3 CR from one reviewer inside 30 min → `feedback=1, CR=3` ⇒ **CR > feedback**,
   breaking the PR's own `toBeLessThanOrEqual` and making the dashboard's *"of which CR"* column
   exceed its parent. **Not live** (0 census PRs have repeated CR from one reviewer) and the test's
   fixture spaces them a day apart **so it can never catch this**.
3. 🟡 **The TTL fix reaches past reviews: a closed issue's `comments`+`timeline` go 1h → 24h**
   (base gave them `TTL_MED` regardless of state; head routes them through parent-terminality) —
   a **24× freshness loss on a path the body never mentions**. Closed issues are NOT quiet:
   of 18 recently-closed slang issues, **4 got post-close comments** (3 authored by our own bot)
   and **6 got post-close cross-references**. One flips a funnel bucket: issue **12350** closed
   `completed` 08-04, bot PR **12186** cross-referenced it 08-06 01:58 ⇒ that timeline read is what
   moves it `resolved_elsewhere` → `bot_pr`, the win-rate numerator, now up to 24h stale.
   ⭐**And the inheritance crosses loops** — the mapping loop fetches `issues/N` (line 445) BEFORE
   the issueParts loop reads the same issue's timeline (line 552), simulated against the real
   `gh()`+`terminalLookup`+`diskCacheTtl`; control (issue never seen by the mapping loop) stays 60min.
   ⭐⭐**Terminality one-way is sound for the PARENT'S STATE — verified 0 `reopened` across 1,200
   slang issue events and 0 in slangpy/nanoclaw/slang-rhi, against 36/16/106/27 `closed` as
   per-repo controls — but a sub-resource is not immutable just because its parent is.**
   `pulls/N/reviews` genuinely is (1 post-merge review row in the entire census); issue comments
   and timeline are not.
4. 🟡 **"Reviewed" bundles two different things: 60 of 100 reviewed merged PRs score 0 feedback
   rounds** (49 approve-only, 10 approve+dismissed, 1 dismissed-only). Mean over PRs that ACTUALLY
   got feedback = **1.80** vs published 0.72 ⇒ the headline is half denominator effect. The
   APPROVED-is-not-feedback call is right (**23 of 66** sampled approvals have an empty body, 38
   more under 40 chars), so this is a panel-readability ask (`no-feedback` column), not a rule change.

**Note posted on `sessionGapMinutes`:** the artifact publishes the gap but not that gaps **CHAIN** —
8 submissions 25 min apart span 175 min and collapse to **1** round (control: 31-min gaps → 8).
Headline sensitivity `0.96`@0 → `0.78`@15 → **`0.72`@30** → `0.70`@60 → `0.57`@1440. Real exposure
small (longest actual collapsed session **50 min**, `jkwak-work` on 12156) ⇒ 30 min defensible;
asked for one doc line that a session is a **transitive run**, not a bounded window.

## Instrument notes

⚠️**Disclosed in the comment:** no docker/DB here, so the aggregation was exercised against the
real census **through the shipped module** rather than through `funnel.ts`'s DB spine.
`tsc -p tsconfig.json` → 4 `TS2307` (`js-yaml`, `@chat-adapter/telegram`) = **my env, proven by
re-running identically at `origin/nv-main`**; prettier clean on all 3 `.ts` with the repo
`.prettierrc` (the bare `prettier --check` outside the repo warns — **config-relative, run it from
the checkout**). `GET /users/slangbot` → **401 `app_not_connected`**, so "`slangbot` is a formatting
bot not a reviewer" rests on its PR titles (`Format code for PR #12080`) + **0** review rows, not on
the account record ([[feedback_published_negative_env_claims_need_rederivation]]).

⛔**The 200-PR census TIMED OUT twice mid-run (2 min tool cap) and I resumed by pinning the last
completed PR number**, not by restarting — the naive restart would have cost 4× the calls. Resume
key: `tail -1 reviews.tsv | cut -f1` → locate in `prs.tsv` → `tail -n +N`.

⛔**`gh api ... -q '.type,.login'` on a 401 prints the JSON ERROR BODY to stdout** and reads as
data; one of my earlier probes captured `{"connect_url":...}` into a `lastReview=` variable and
would have published it as a timestamp. **Range-check any captured field's SHAPE, not just
non-emptiness.**

⚠️`search/issues?q=...` returns **`unexpected end of JSON input`** under OneCLI here (not 0, not an
auth error) — used `repos/:owner/:repo/issues/events` pagination instead, with `closed` as the
must-hit control.

## RESUME

No-op unless (a) a substantive human reply lands on comment **5205856282** — finding 1 (DISMISSED
erasure) is the only one worth a follow-up PR and it is live on `nv-main`; (b) a new PR touches
`funnel-metrics.ts` — then re-check all four (each is a one-line probe: `DISMISSED` in
`FEEDBACK_STATES`, whether `changesRequestedRounds` collapses, whether `diskCacheTtl`'s
sub-resource inheritance is route-restricted, whether the panel has a `no-feedback` column).
Merged, so nothing to gate. Sibling `#1107` (`regression-quality: fail closed, cohort the
numerator`) is the F07 companion this PR's cron comment forward-references.
