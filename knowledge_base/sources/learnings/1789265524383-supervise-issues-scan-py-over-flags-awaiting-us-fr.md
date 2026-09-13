---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-13T02:12:04.383Z
---

# supervise-issues scan.py over-flags awaiting_us from non-bot timeline events (shepherd subscribe/mention)

## Symptom
Tick 221: 3 of 7 coworker nudges (slang#13034, #13039, #13037) came back from slang-fixer as **false-positive `awaiting_us`**. #13034/#13039 were legitimate fixer-owned-carve-out flags that just lacked a recorded disposition (expected — the nudge got the disposition recorded). But **#13037 was a genuine ball-direction misread**: scan.py said "human spoke last 16:53Z / awaiting_us" on draft PR #13038, yet the fixer verified there is **no human comment at all** — every comment is a bot (coderabbit/CLAassistant/PR-board-sync), and the only non-bot login (`jhelferty-nv`) is the **PR-board auto-assigned shepherd** who was `mentioned`/`subscribed` at 16:28Z but **never commented**. The "16:53Z human" was the shepherd's non-bot *timeline events* + the fixer's own push `updated_at` (16:51:53Z) being read as a human comment.

## Root cause (for the skill maintainer)
`scan.py` ball-direction ("latest actor is a non-bot with no bot reply after → ball ours → awaiting_us") appears to count GitHub **timeline events** (subscribe, mention, label, assign, board-sync) or `updated_at`, not just actual issue/PR **comments** and **reviews**. Auto-assigned shepherds and PR-board automation generate non-bot timeline activity that is NOT a human speaking. This yields false `awaiting_us` → false nudges into fixer sessions every tick (waste + noise; each costs the fixer a turn to disprove).

## Fix direction
Ball-direction should key ONLY on real `IssueComment`/`PullRequestReview`/review-thread comments authored by a non-bot, ignoring: timeline events (subscribed/mentioned/assigned/labeled/board-sync), and the PR/issue `updated_at` (a bot's own push bumps it). Treat auto-assigned shepherd/board logins as non-speaking unless they actually commented. A draft bot PR with only bot comments + a subscribed shepherd is `awaiting_human` (awaiting maintainer review), not `awaiting_us`.

## Operational note
When a fixer replies to an `awaiting_us` nudge with "no human comment exists, verified", record a parked disposition in supervisor-state.json (`advisory:maintainer-driving` / `pr_open` + the verification) so the fixer-owned carve-out and ball-direction don't re-flag it next tick. Don't ack the fixer (noise). Recorded this for #13034/#13039/#13037 on Tick 221.
