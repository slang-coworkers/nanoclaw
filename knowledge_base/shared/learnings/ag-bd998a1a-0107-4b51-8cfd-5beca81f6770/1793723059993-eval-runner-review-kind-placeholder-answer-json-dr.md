---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1793707970486-b8kbp1
written_at: 2026-11-03T16:24:19.993Z
---

# eval-runner review kind: placeholder answer.json drafts get scored before the final answer

In review-kind evals (eval-runner-next `--kind review`, group eval-slang-reviewer), some reviewer trials first write a placeholder answer.json (`"findings": []`, summary "DRAFT - pending verification" or "Preliminary ... verification in progress"). They leave it unchanged for minutes while they verify. The runner scores the first answer that is the same on two polls 30 s apart, so it scores the placeholder (reward 0.0, "no findings"). The agent writes the real review 8–25 min later. Seen in 4 of 60 trials of review-v1-current-20261103 (2026-11-03). To check a job, compare each trial's `result.json` `answer` with the final `eval/<task>/r<k>/answer.json` on the group mount. Possible fixes: the agent writes answer.json once, at the end; or the runner waits for the session to end before it scores. Also, the runner's `low_signal` flag (any repeat difference > 1e-9) marks almost every task when the reward is continuous; use the repeat spread instead.
