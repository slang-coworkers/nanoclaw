---
name: project_nanoclaw_1100_clamp_escalation_strip
description: "slang-coworkers/nanoclaw#1100 reviewed inline; headline: escalation strip nested inside approvalCount>0 so it's dark on an EMPTY queue — the exact state the PR exists to disambiguate. Merged mid-review, blobs identical. Comment 5201579021."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1100
---

**slang-coworkers/nanoclaw#1100** — `dashboard: clamp every approval reason, add a critique-gate
strip`, author **`szihs`** (human), base **`nv-dashboard`**, branch
`fix/nv-dashboard/clamp-and-escalation-panel`. 2 files, +86/−3. Head `4c43c9c1`, base `9a30fb96`
(clean single-parent rebase). `ci` + `label` green. Third in the chain after
[[project_nanoclaw_1095_critique_card_render]] → [[project_nanoclaw_1098_critique_card_followup]].

**ROUTING: handled INLINE by Main — ~25th instance** ([[project_nanoclaw_pr874_webhook_route_approver]]).
No `nanoclaw-pr-approver` exists; slang/slangpy approvers are repo-scoped ⇒ would `ABSTAIN_POLICY`.
Posted via `gh api .../issues/N/comments -F body=@file`. Comment **`5201579021`**.

🔴 **MERGED MID-REVIEW at 07:05:39Z, ~10 min BEFORE I posted** (squash → `nv-dashboard` `f291e96c`,
single parent = base). Both blobs of reviewed head **byte-identical to merged tip by hash**
(`app.js` `e3f3d3f2`, test `67432774`) ⇒ review applies as-is. **Merge-race count on this fork keeps
climbing — 3rd in a row on this branch chain.** Check `mergedAt` BEFORE drafting, not after.

## 🔴 Headline: the strip is dark in exactly the state the PR exists for

`renderEscalationStrip()` is interpolated **inside** the `approvalCount > 0` ternary
(`app.js:5854`, sole call site besides the definition). PR's own motivation: *"after #1092 an empty
queue no longer distinguishes 'the gate is working perfectly' from 'the gate is disabled'."*
Executed with the ternary lifted verbatim: **0 pending ⇒ `bannerHtml === ''`, strip invisible**;
1 pending ⇒ visible. Three real `failed_open` releases + empty queue ⇒ nothing displays. The strip
renders fine standalone, it just has no host element. Fix = hoist out of the ternary; safe because
it already returns `''` on null/`totals:[]` (verified across 7 summary states).
⭐⭐⭐ **A feature whose whole point is "the queue can't tell you this" was mounted ON the queue.
The bug is in the MOUNT POINT, and no amount of reading the new function finds it — only asking
"under what condition does the container render" does.**

## 🟡 Others
- **New orphan `show more` on `onecli_credential`** — branch renders method/host/path, never the
  reason, but the toggle is appended for every generic branch. Base-vs-head control: base `false`,
  head `true` ⇒ **introduced here**, not inherited (mobile.js:441 has had it since #1098 =
  pre-existing, not charged). **Unreachable today**: sole producer (`nv-main`
  `onecli-approvals.ts:150-158`) writes no `reason` key.
- **The 5 new tests cannot distinguish the headline bug** — all 5 predicates pass against the buggy
  shape. Non-inertness ≠ discrimination.
- `rejected`/`expired`/`self_heal` events dark in the strip (judgment call).

## ✅ Verified positively
Clamp matrix **24/24** (action × length × expanded, tail marker past char 300). `md()` DOES escape an
embedded anchor (executed) ⇒ append-after design claim correct. **Tests non-inert both directions:**
base tree + head test file (md5-verified swap) = **9 pass / 5 fail** = exactly the 5 new `it()`s;
head 14/14; full suite **1382/0** head vs **1377/0** base, 103 files both ⇒ delta **+5 tests, 0
files**. Escaping clean (`escAttr` on `data-rid`, hostile reason/days); `&amp;amp;` double-escape
reproduced on base ⇒ pre-existing. Event vocabulary checked against **`nv-main` `237ec1d8`**, not
this branch's stale `src/**` ([[feedback_leaf_branch_copies_of_owned_files_are_stale_by_design]]).

## ⛔ Instrument failures this review — three, all caught
1. **Brace-matching harvester swallowed 114 KB on `escAttr`** — its `/"/g` regex literal opens a fake
   string to a string-aware scanner. `9 fns → 125 KB` was the only tell. Replaced with a col-0 `}`
   terminator (prettier-formatted source) **plus per-function `node --check`** so an over-long or
   truncated extraction fails LOUDLY. ⭐⭐ **A harvester that returns *something* for every name has
   no failure signature; size was the accident that exposed it.**
2. **Subagent's `git checkout` moved the worktree mid-review**, after ~8 measurements. Re-pinned
   `git show <sha>:<path>` snapshots to `/tmp/snap`, `git hash-object`-verified against the commit
   blobs, and **re-ran all three load-bearing findings** against them. ⭐⭐⭐ **Launching a background
   agent that mutates the tree you are measuring invalidates every prior measurement — snapshot by
   blob FIRST, or don't delegate into your own workdir.**
3. Subagent's own catch, worth keeping: **`git checkout -- <file>` restores from the INDEX**, which
   still held head's copy after `git checkout pr1100 -- <file>` — its "clean base" run would have
   been contaminated. md5 + empty `git diff --cached` caught it; `git checkout <base-sha> -- <file>`
   is the correct restore.

⚠️ **`tsc --noEmit` exit 0 covers NEITHER file this PR touches** — `tsconfig.json` has
`include: ["src/**/*"]`, `--listFiles | grep -c dashboard` → **0**. Disclosed in the comment so the
green isn't over-read. ⭐ **A passing typecheck is scoped; state the scope or it reads as coverage.**

**RESUME:** merged. Finding 1 is a live one-line defect **on `nv-dashboard` now** — if szihs replies
or a follow-up PR lands, the fix is hoisting `renderEscalationStrip()` out of the `approvalCount > 0`
ternary in `renderCwMessages` (~`app.js:5851-5855`), plus a guard test that pins it outside the
`approval-banner` literal. Orphan-toggle one-liner and the mobile `Approve once` label
(carried from #1095, still unfixed) are the smaller follow-ups.
