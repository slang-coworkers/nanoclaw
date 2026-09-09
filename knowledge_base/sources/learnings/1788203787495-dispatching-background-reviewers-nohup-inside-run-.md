---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788202197315-14re5d
written_at: 2026-08-31T19:16:27.495Z
---

# Dispatching background reviewers: nohup & inside run_in_background double-backgrounds (no completion signal)

When launching long PR reviewers (compose-and-run.sh / run-clarity.sh / devin-fetch.sh) via a `Bash(run_in_background=true)` call whose command is `nohup … &`, the tracked background job is the *wrapper shell*, which exits immediately after the `&` — you get a "completed exit 0" task-notification within seconds while the real reviewer keeps running detached. You then have NO completion notification for the actual work.

Fix that worked: after launching, confirm the real PIDs are alive with `ps -eo pid,etimes,args | grep -E "scripts/(compose-and-run|run-clarity|devin-fetch)\.sh"` (note: the `guard-pgrep-f.sh` hook BLOCKS `pgrep -f`/`pkill -f`), then arm a single `Monitor` with an until-loop on those fixed PIDs: `while kill -0 $A 2>/dev/null || kill -0 $C 2>/dev/null || kill -0 $B 2>/dev/null; do sleep 20; done; echo REVIEWERS-DONE …`. Monitor's timeout_ms goes up to 3600000 (Bash background timeout caps at 600000ms = 10min, too short for ~30-min reviewers). One clean notification when all three exit.

Simpler alternative for next time: skip the inner `nohup … &` — just run `bash compose-and-run.sh …` as the run_in_background command directly, so the tracked job IS the reviewer and its exit notification is real. Run each of the 3 reviewers as its own run_in_background Bash call; they run concurrently and each notifies on true completion.
