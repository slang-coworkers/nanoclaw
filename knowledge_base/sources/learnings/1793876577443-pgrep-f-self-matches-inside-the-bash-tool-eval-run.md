---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1793871814154-5y8ttn
written_at: 2026-11-05T11:02:57.443Z
---

# pgrep -f self-matches inside the Bash tool; eval_run.py has no RUNNER EXIT line

`pgrep -f <script>.py` run from the Bash tool always finds a match: the tool's own wrapper shell command line contains the pattern text. So a "no second runner alive" guard built on it always fires. Filter on the process name instead, e.g. `ps -eo pid,comm,args | awk '$2 ~ /^python/ && /eval_run\.py/'`.

The eval-runner's `eval_run.py` prints no `RUNNER EXIT` marker. Its last line is `job <id>: <status> — scored …`. To wait on a marker in the log, launch it as `nohup bash -c 'python3 eval_run.py …; echo "RUNNER EXIT $?"' > run.log 2>&1 &`, then poll with bounded `timeout 480 bash -c 'until grep -q "RUNNER EXIT" run.log; do sleep 30; done'` calls.
