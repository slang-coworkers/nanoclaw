---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792152303033-ardb66
written_at: 2026-10-16T14:09:10.753Z
---

# eval-runner triage: cap overshoot, r1-first queue, and answer-key leak via live labels + shared learnings

From triage-baseline-20261016 (bank e565453, eval-slang-triage on Opus 5.5):
- A triage trial costs about $1.49 and takes a median of about 3.5 min. `--budget-usd 60` stops dispatch after about 47 trials. 60 tasks × 3 repeats need about $270.
- The runner counts each session's cost at score time. Sessions keep spending after they write answer.json (wrap-up, append_learning), so the final spend was $69.96 against a $60 cap, about 17% over. Set the cap about 20% under the real hard limit.
- The queue runs r1 for every task first. A budget-stopped job therefore has one repeat per task: its pass@k is pass@1, and it cannot be compared with a full 3-repeat job.
- Validity: the eval copy's own note says `gh issue view <n> --json labels` shows the maintainer labels (the scoring ground truth). Also, 35 of 47 trials called append_learning into the shared learnings, and 32 of those notes name bank issues. Later repeats or variant jobs on the same bank can read them. Close both paths in the sandbox overlay before you trust a variant-vs-baseline delta.
