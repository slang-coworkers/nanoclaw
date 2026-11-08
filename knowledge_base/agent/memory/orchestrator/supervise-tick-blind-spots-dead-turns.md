---
type: runbook
description: /supervise-issues blind spots where a turn was killed by a restart, gateway error or context overflow (shapes 10, 11, 13, 14, 18) — trace-based detectors and the resume nudge. Split from supervise-tick-blind-spots.md 2026-11-07.
---

# Scan blind spots: turns killed mid-flight

Part of [[orchestrator/supervise-tick-blind-spots.md]] (hub). Shape numbers are stable and cited by the tick runbook's
helper list. Siblings: [[orchestrator/supervise-tick-blind-spots-session-stalls.md]],
[[orchestrator/supervise-tick-blind-spots-github-state.md]].

All of these read as live (`running`) or as `awaiting_human` to scan; only the `.claude-trace/session-*.jsonl` tells.
The fix is the same each time: a pinned resume nudge that **names the unfinished step**.

10. **Fleet restart killed a coworker mid-tool-call** (tick 298, 00:20Z). Containers that were `running` show `stopped`
    with no `out` after their last inbound, so scan reads `awaiting_human`; blind.py misses it because the newest row is
    the coworker's own progress `out`. Detector: for every trace modified since the fire, parse the last request's
    `body_raw` SSE `message_delta.stop_reason`; **`tool_use`** on a now-`stopped` container means the turn was killed
    (`end_turn` = it finished). Tick 298 found #13632 (fix done, PR not opened for jkwak-work's ask) and rhi#911 (GitHub
    post landed, report not sent); both running in < 8 min. The supervisor's own tick can die the same way: resume from
    the `tickNNN/` artifacts, don't restart the pull.
11. **Gateway key budget hit killed a turn** (tick 299, #13828). For 22 s (10-22 07:42:25–47Z) every model call got HTTP
    422 `budget_exceeded`: LiteLLM key `slang_coworkers-prod-svc_slang_dev` was at $32.7k against a $25k max. The SDK
    retried 5× across models, then the turn ended; the last trace line has no `stop_reason`, so shape 10 misses it.
    Detector: grep traces modified since the fire for `"status_code": 422` with `budget` in the body; sessions with no
    later 200 are dead (`tick299/budget.py`). Resumed in 3 min. Escalate the key budget to the operator — a longer
    window stalls the whole fleet.
13. **Context overflow, and the session stopped since the last tick** (tick 309, #13828 / draft #13867). Every
    main-thread call of fixer `4stbs2` returned HTTP 400 (598–682 messages, 4.5–7 MB per request; the gzip body can't
    be decoded); the turn ended with no `out`. blind.py missed it because the session was `running` at the previous
    re-list. Detector: `tickNNN/runstop.py` flags open-chain sessions that went `running` → stopped since the previous
    `sessions2.json` (copy it to `prev-sessions2.json`); check the trace for runs of 400s with message counts in the
    hundreds. A pinned nudge recovered it (compacted to ~280 messages after ~4 min of 400s). **Wait at least 5 min
    after a nudge before calling a session wedged** — tick 309 posted a reset request and had to correct it.
14. **Gateway 429 wave** (tick 314, 10-29 21:58–22:01Z). HTTP 429 `rate_limit_error` ("Model capacity reached for
    azure/anthropic/…, Priority: prod") on 27 sessions; 4 never got a later 200 (#12714 triager + Main, #14026 fixer,
    #13685 fixer). Containers stayed `running`; shapes 10/11 miss it. Worst case #13685: the bot had acked
    pdeayton-nv's "file a new issue and fix it" with "On it", and nothing was filed for 2.5 h. Detector:
    `tickNNN/rl429.py` (429s since the previous tick with no later 200 → DEAD). All 3 nudges landed within 4 min.
18. **Gateway 5xx wave** (tick 326, 11-04 22:39–23:16Z). HTTP 503 "upstream connect error … connection timeout", then
    HTTP 500 on every SDK retry for ~3 min per session; 13 sessions had no later 200 and none self-recovered (several
    posted the runtime's "Sorry, something went wrong" row). `rl429.py` misses it. Detector: `tickNNN/rl5xx.py`
    (429/500/502/503/504/529 with no later 200, reading each trace's last 6 MB). Triage each DEAD row by its newest
    `in`: ack-only ("Learning saved") or moot → no nudge; owed work → pinned resume. 6 of 13 owed work; all resumed in
    ≤ 10 min. **A dead Main chain session resumes the same way:** `send_message(to="orchestrator",
    target_session_id=<Main sid>, thread_id=<its gh-issue thread>)` landed in that exact session in 1 min
    (slangpy#1260, `z557lh`), with no self-loop to the legacy null-thread session — the pin wins when the cron
    session's auto in_reply_to has no source session.
