---
type: chain-log
title: slang#13391 / PR #13402 — dated re-chase log
description: Dated readings of the #13402 Tint-CI deadlock (10-03 → 11-09) — the deleted run, the A/B/C operator asks, the 12 weekly/daily re-chases and what each found; current state, findings and lessons live in the chain record. New dated entries append here.
---

# slang#13391 / PR #13402 — dated re-chase log

Chain record (current state, findings, lessons): [[slang/13391-wgsl-tint-std140.md]].
New dated entries go **here**, one bullet each. Condensed 2026-11-09 (OKF fold). Re-chases that changed nothing
are one line each. A = fixer cancel + rerun, B = un-draft, C = keep waiting.

## Before 10-08: the deadlocked run (historical)

- Runs 37044924072 (`e67493dc`) and 37045404089 (`4b60e354`) were cancelled because newer pushes superseded them.
- Run **37055310934** on `fa23079922` (workflow_dispatch, attempt 1) stayed `waiting`. `wait-for-human-priority` yielded at 10-02 19:37Z
  behind older bot runs, so every build/test job was skipped. `falcor-build-approval-gate` waited on the `falcor-ci` env, and
  `current_user_can_approve=false` for us.
- The hourly `ci-retry-yielded-bot` logged "CI is still active (96–100 run(s)); not rerunning". About 94 nv-slang-bot runs were parked
  on the same falcor gate. This is the [aged-run lesson](../imported/feedback_an_aged_run_does_not_escalate_a_rerun_does.md): only a
  rerun escalates, and the rerunner was blocked. The run left the retry script's 16 h lookback at about 10-03 11:37Z.

## 10-03 → 10-08: daily re-chases and the A/B/C ask

- **10-03** still gated; human-park reported to the dashboard (msg 9). Fixer not nudged.
- **10-04** no change; reminder (msg 5).
- **10-05 (3rd)** no change, 105 runs `waiting`. Found a bot-side unblock (A): cancel and then rerun 37055310934. The age then counts from
  the fixed `created_at` (~62 h, over the 12 h ceiling in `wait-for-priority.py` `run_age_hours`), so the Windows x64 jobs run. Falcor
  would still wait, but it gates only its own jobs. Precedent: rerun of 32710766460. The `ask_user_question(timeout:0)` card aborted at the
  1800 s MCP idle limit. I re-posted A/B/C on the dashboard (msg 25).
- **10-06 (4th)** no change. jkiviluoto-nv's PR #13451 ("Keep approval-only waits from blocking bot CI") targets the deadlock; unmerged.
- **10-07 (5th)** no change, 109 `waiting`. szihs asked to split Falcor into its own workflow, so #13451 may be redesigned.
  11:19Z jkiviluoto-nv filed and self-assigned #13478 (Falcor split). It was parked for the assignee.
- **10-08 (6th)** ⚠️ run 37055310934 returns **404**, and so do 37044924072, 37045404089 and 37029442825. `created=2026-10-01T20:05Z..10-03T10:07Z`
  returns 0 runs repo-wide, so it looks like a bulk deletion of that window (cause and actor unknown). **A is dead.** I found that B works
  (`IS_THROTTLED_BOT`; proof: #13450's run 37724999088, 47/47). 6th ask (B or C, every 2 days), msg 15.
- **10-08 11:32Z** the operator asked for a #13478 triage (dashboard msg 36). It was dispatched as advisory, with no fixer.
  12:25Z triage done ([cmt 6059786647](https://github.com/shader-slang/slang/issues/13478#issuecomment-6059786647)):
  - the optional jobs are only the 3 Falcor jobs, none of which is in `check-ci`'s needs;
  - dropping `workflow_dispatch` is enough to exclude bot draft runs;
  - `ci_health.py` and `pr-ci-complete.yml` match on the workflow name "CI";
  - it needs a landing order with #13451.
  ❌ My 11:32Z dispatch still called the run `waiting` (see the record's lessons).

## 10-10 → 11-09: slower cadence, then park

- **10-10 (7th)** no reply; head draft and `BEHIND`, 0 head runs, 113 `waiting`. Offered weekly cadence (msg 11).
- **10-12 (8th)** no reply. jkiviluoto-nv's #13526 touched `ci.yml` (wasm `build-llvm: false` only), so the gate is unchanged. 107 `waiting`.
  Moved to weekly on my own (msg 13).
- **10-16** external #13704 is the entry-point-uniform sibling (see record).
- **10-19 (9th)** no reply; 74 behind master, 76 `waiting` (msg 13).
- **10-25** external PR #13935 (for #13904) makes the same one-line change (see record).
- **10-26 (10th)** no reply; 127 behind. `ci.yml` changed (#13794, #13813, #13881): the Windows GPU test jobs were merged into one job per
  config, but no gate lines changed. 99 `waiting`. Added a "park" option (msg 9).
- **11-02 (11th)** no reply; 169 behind, 158 `waiting`. #13935: jhelferty-nv was review-requested, then removed on 10-28. Said the next
  re-chase is the last (msg 11).
- **11-09 (12th, final) → PARKED, no timer.** No reply (paged the dashboard to seq 511986; the only row naming 13402 is my 11-02 ask).
  215 behind (5 ahead), 0 head runs, 205 `waiting`. #13935 head `5182749de8`, CI `waiting` since 10-25, jkwak-work review-requested.
  Per the [re-ask cap](../orchestrator/reask-cap-park-after-final-ask.md), I recorded the park in `supervisor-state.json` and sent one
  notice (msg 11). No GitHub post: the open draft PR is the resumable artifact.
