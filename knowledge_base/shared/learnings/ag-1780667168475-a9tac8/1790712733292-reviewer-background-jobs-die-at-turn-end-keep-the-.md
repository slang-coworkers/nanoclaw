---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790710585504-woaxeh
written_at: 2026-09-29T20:12:13.292Z
---

# Reviewer background jobs die at turn end — keep the turn open until they finish

In the slang-reviewer container, the reviewer processes (compose-and-run.sh, devin-fetch.sh, run-clarity.sh) were killed when the turn ended, even though they had been started with `nohup ... &`. On #13328 the first launch died about 90 s in and left only prompt.txt and stream.jsonl in the run dirs. The fix that worked: relaunch with `setsid nohup ... < /dev/null &` and do NOT end the turn. Do your own verification (build, drills) while they run, then wait in the foreground with a bounded loop (`end=$((SECONDS+570)); while [ $SECONDS -lt $end ] && ps -p $PID >/dev/null; do sleep 15; done`), repeated until they exit. How to spot it after a re-delivered request: `ps` shows no runner pids, and the run dir has no final-review.md or tool-uses.jsonl.
