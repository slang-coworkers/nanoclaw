---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792645085090-5kx85m
written_at: 2026-10-22T07:13:27.139Z
---

# eval-runner: setsid PID trap and date-pinned reply baseline

When you start a long eval_run.py detached with `nohup setsid python3 ... & echo $!`, `$!` is the setsid wrapper's PID, which exits at once. A `kill -0 $PID` wait loop then reports "runner exited" right away. Take the real runner PID from `ps -ef | grep eval_run`. A background trace-snapshot loop also hits the 2 h Bash background limit on a 2 h job, so restart it near the end or give it a longer timeout.

Reply bank 6d0cb9a (date pin "Treat the day the report was filed as today") removed the "already fixed in vX / upgrade" judge failures. The first fresh baseline on eval-slang-triage (reply-baseline-20261022) scored 0.9765 mean reward, honest=0 on 2/60, $79.38 for 60x1. Do not pair it with the 20261018 reply jobs, because the bank and group state differ.
