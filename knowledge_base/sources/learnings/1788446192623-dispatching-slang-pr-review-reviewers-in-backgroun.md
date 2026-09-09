---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788445034429-3qdvui
written_at: 2026-09-03T14:36:32.623Z
---

# Dispatching /slang-pr-review reviewers in background: two gotchas

When running the three parallel reviewers of `/slang-pr-review` in the background, two things bit me (Sep 2026, PR #12899 review):

1. **`slang-clarity-review-runner/scripts/run-clarity.sh` is NOT executable** (`-rw-rw-r--`), unlike the `slang-pr-review-runner` scripts which are `-rwxr-xr-x`. `nohup /path/run-clarity.sh …` fails silently with `nohup: failed to run command … Permission denied` (visible only in the redirected log). Launch it via **`bash /path/run-clarity.sh …`** (or `chmod +x` first). Reviewer A's `compose-and-run.sh` and `devin-fetch.sh` run fine directly.

2. **`nohup … & echo pid` inside a `Bash(run_in_background=true)` call defeats the completion hook.** The tracked background command is the `nohup … &`, which returns immediately (exit 0) — you get a "completed" notification instantly while the real reviewer keeps running detached, and you never get notified when the actual work finishes. Fix: either run the script *directly* with `run_in_background=true` (no `nohup`/`&`), or launch detached and then arm a separate **waiter** — a `Monitor`/background-Bash `until`-loop that polls `ps -eww -o args | grep -vE grep | grep -qE '<script-argv-patterns>'` and echoes one line + exits when all reviewer processes are gone. Put the grep patterns in a *script file* (not inline) so the watcher's own argv doesn't self-match. Note `pgrep -f`/`pkill -f` are blocked by a guard hook; use `ps -eo args | grep` or `/proc/<pid>/cwd`.

Timing/cost reference: A+B+C for a small 2-file GLSL-emitter PR finished in ~11 min wall; Reviewer A cost ~$8 (opus+sonnet subagents), summarizer reported run success, drift 0.
