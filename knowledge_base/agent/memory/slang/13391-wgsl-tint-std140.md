---
type: chain
title: slang#13391 / #8323 — WGSL-via-Tint std140 layout (draft PR #13402)
description: Draft PR #13402 is done on our side; its last signal (real Tint on the Windows x64 CI rows) is held behind a deadlocked bot-CI gate.
---

# slang#13391 + #8323 → draft PR #13402

- **PR:** https://github.com/shader-slang/slang/pull/13402, branch `fix/issue-13391`, head `fa23079922` (pushed 10-02 19:37Z). It is a draft, assigned to and review-requested from kaizhangNV.
- **Owner:** slang-fixer session `sess-1790934848504-cxpbfi`, thread `gh-issue-shader-slang/slang-13391`.
- **Our gates:** peer review round 2 was APPROVE_WITH_NITS (10-02).
- **Remaining signal:** real Tint on the Windows x64 rows: `tests/wgsl/wgsl-spirv-uniform-std140.slang.1/.2` and `tests/metal/stage-in-2.slang`.

## CI state (verified 2026-10-05 10:39Z — unchanged since 10-02)

- Runs 37044924072 (`e67493dc`) and 37045404089 (`4b60e354`) were cancelled, both superseded by newer pushes.
- Run **37055310934** on `fa23079922` (workflow_dispatch) is on attempt 1 with status `waiting`. `wait-for-human-priority` yielded at 19:37Z behind older bot runs, so every build/test job is skipped. `falcor-build-approval-gate` is waiting on the `falcor-ci` env, and `current_user_can_approve=false` for us.
- **The retry path is deadlocked.** Every hourly `ci-retry-yielded-bot` fire logs "CI is still active (96–100 run(s)); not rerunning". About 94 nv-slang-bot runs (101 repo-wide runs by 10-04) are parked `waiting` on the same falcor gate. This is the mechanism in [the aged-run lesson](../imported/feedback_an_aged_run_does_not_escalate_a_rerun_does.md): escalation only happens on a rerun, and the rerunner is blocked by those waiting runs.
- The run leaves the retry script's 16h lookback at about 11:37Z on 10-03. After that, only a manual rerun works. A rerun would escalate, because the run's `created_at` age is over 12h.

## History

- **2026-10-03 10:00Z re-chase:** still gated. I reported the human-park to orchestrator-dashboard (msg 9): a `ci-approvers` maintainer needs to resolve the falcor gate and rerun 37055310934, or the PR can be un-draft-ed. slang-fixer was not nudged. Next re-chase is `rechase-13402-tint-ci-001b` at 2026-10-04 10:00Z.
- **2026-10-04 10:00Z re-chase:** still gated. Nothing changed: head, attempt 1 `waiting`, no human comments on #13402, #13391, or #8323. I sent a one-line reminder to orchestrator-dashboard (msg 5). Next re-chase is `rechase-13402-tint-ci-00-2332` at 2026-10-05 10:00Z. If that is the third unanswered reminder, escalate with `ask_user_question` rather than another reminder.
- **2026-10-05 10:00Z re-chase (3rd):** still gated, nothing changed (head `fa23079922`, attempt 1 `waiting`, no human comments on #13402/#13391/#8323; 105 repo runs now `waiting`, oldest 09-15). No operator reply to the 10-03/10-04 reminders in the dashboard session. **New finding — a bot-side unblock exists:** a run can't be rerun while it is `waiting`, but if slang-fixer **cancels 37055310934 and then reruns it**, `wait-for-human-priority` re-evaluates with age measured from the fixed `created_at` (~62h, past the 12h ceiling; `wait-for-priority.py` `run_age_hours`). It escalates, and the Windows x64 build/test jobs run, because they depend only on that gate, not on falcor. The falcor gate would wait again, but it only blocks `build-windows-release-cl-x86_64-gpu-falcor`/`test-falcor`. Precedent: nv-slang-bot reran 32710766460 (attempt 2). I escalated with `ask_user_question(timeout:0)`, but the card hit the 1800s MCP idle limit and aborted with no answer. ⚠️ In a task run with no attached chat, a `timeout:0` card is not a durable ask. I re-posted the A/B/C ask on orchestrator-dashboard as msg 25, where A = fixer cancel+rerun, B = un-draft and C = keep waiting. Next re-chase is `rechase-13402-tint-ci-a*` at 2026-10-06 10:00Z.
- **Resumes on:** a new run attempt or new head with results, a human comment or review, or the operator's un-draft decision.
