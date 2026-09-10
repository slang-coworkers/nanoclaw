---
name: slangpy_1074_onboard_pr_dashboard
description: "slangpy#1074 \"Onboard repo to PR dashboard\" — RESOLVED 08-04 by maintainer's own PR #1084 (board-sync onboarding); was option (c), a board neither triager nor Main knew of"
metadata:
  node_type: memory
  type: project
  originSessionId: 02ffd96f-c9c0-4417-b035-8ba11e98f750
---

**shader-slang/slangpy#1074 "Onboard repo to PR dashboard"** — opened 2026-07-24 by **jhelferty-nv** (maintainer), empty body. **CLOSED 2026-08-04T19:41:59Z** by author. Milestone Q3 2026.

## Resolution
jhelferty answered our a/b/c clarifying question with **"Onlined in #1084."** — i.e. **option (c)**: a third dashboard, the **"Slang PR Tracking" board (org project #10)** synced via slang's reusable `pr-board-sync.yml`. He implemented it himself. **PR #1084 merged 2026-08-04T15:11:25Z** (`onboard-pr-board-sync` → `main`).

#1084 shipped: thin callers for `pr-board-sync.yml` (Status/Source/assignment/fork-review relay), `pr-checks-complete.yml` wired to slangpy's gating `ci`+`checks`, `pr-sweep-nightly.yml` (cron `0 7 * * *`, `mode: sweep`), retiring `add-pr-to-project.yml`. Callers use org secret `SLANG_PR_BOT_TOKEN`, `permissions: {}`.

## Verified (Main, 08-04)
- Old `add-pr-to-project.yml` **gone** from `main`; new files present: `pr-checks-complete.yml`, `pr-sweep-nightly.yml`, `pr-maintenance.yml`, `pr-review-fork-{bridge,apply}.yml`.
- **6 board-sync caller runs post-merge, all `success`** (PR Checks Complete Sync ×4, PR Maintenance ×2).
- **Org secret resolves** — decisive: the guard step `"Note skipped (no token)"` was itself **skipped**, and `"Reconcile board (add, Source, Status)"` **ran + succeeded** (not skipped) ⇒ real board write, not a no-op. This satisfies #1084 test-plan item 1, which he left unticked.

## NOT verified — instrument blind, do not re-derive
**Board contents are unreadable from Main's seat.** `gh project list` → empty/exit 0; `projectsV2 totalCount` → **0**. Both are **instrument failure, not data**: decisive control — project **#10 provably exists** (named in this repo's own live `sync-issues-to-project.yml`) yet the same token returns `NOT_FOUND` for it. Main's `GH_TOKEN` (nv-slang-bot[bot]) **lacks project scope**; `gh auth status` also reports it invalid. ⇒ Never report slangpy's board tile state from Main; the caller-run + step-outcome evidence above is the strongest available proxy.

Never fired yet: `PR Board Sweep (nightly)` (0 runs — merged same day, cron `0 7 * * *` not yet reached). Not a defect; first natural fire ~08-05 07:00 UTC is the backstop check.

## Lessons
- ⭐⭐ **A maintainer can resolve an ops chain out-of-band while we hold it parked** — his answer named a target *neither* the triager nor Main had enumerated. Our (a)/(b) "already covered" finding was true and irrelevant to what he wanted; enumerating two known dashboards did not license "those are the options."
- ⭐⭐ **`success` on a reusable-workflow caller is not proof the effect happened** — a skipped/no-op job reads identically in `gh run list`. The discriminator is **step-level outcomes**, and here a *negatively-phrased guard step* (`Note skipped (no token)`) being **skipped** was the cleanest positive evidence the token resolved. Prefer a step whose skip/run polarity is opposite to the thing you want to confirm.
