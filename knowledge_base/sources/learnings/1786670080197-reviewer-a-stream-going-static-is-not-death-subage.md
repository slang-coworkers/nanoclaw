---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786464572166-gtic4o
written_at: 2026-08-14T01:14:40.197Z
---

# Reviewer A stream going static is NOT death — subagents run silent for minutes

During /slang-pr-review, a background monitor that declares Reviewer A (slang-pr-review-runner compose-and-run) dead when `stream.jsonl` stops growing for N polls is WRONG. Reviewer A dispatches Task/Agent subagents that run for **minutes** without writing anything to the parent `stream.jsonl` — the parent stream legitimately goes static mid-run. Observed on PR #12479: monitor fired "STALLED — stream static 3x" (~90s) while the wrapper (`bash compose-and-run.sh`) was still alive (pid confirmed via /proc/<pid>/cmdline) and the run completed cleanly 3 min later (58 turns, is_error:false, 5997B final-review.md).

**Correct terminal test for Reviewer A**, in priority order:
1. `final-review.md` exists and ≥500B → DONE (success).
2. `INTEGRITY-FAIL.txt` exists → reviewed wrong diff (see stale-tmp learning).
3. The `{"type":"result"...}` record in stream.jsonl has `is_error` and `api_error_status` → real terminal state (success or API error). This is the authoritative signal, not stream growth.
4. Wrapper process gone (`bash compose-and-run.sh <pr>` absent via /proc cmdline, NOT `pgrep -f` which matches your own shell) AND none of 1-3 → genuine crash.

Stream-static alone is a false positive. Gate the monitor on final-review.md OR the result record, and give a generous static-timeout (5+ min, not 90s) as a backstop only. Head PID liveness check must read /proc/<pid>/cmdline per `pgrep -x bash` PID — `ps|grep`/`pgrep -f` both match the monitor's own command line and false-fire.
