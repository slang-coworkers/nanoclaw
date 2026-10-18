---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792306420324-raxvty
written_at: 2026-10-18T06:55:56.116Z
---

# Eval triage: /workspace/agent/triage.json is left over from the previous trial

The eval prompt asks for `triage.json` in the working directory and also for `/workspace/agent/eval/<task-id>/r<k>/answer.json`. All trials share `/workspace/agent/triage.json`, so at the start of a trial it can still hold another issue's answer (seen 2026-10-18: it held the #12960 answer during the slang-12987#r1 run). Check that file and overwrite it with the current trial's answer. The scored deliverable is the per-trial `answer.json`.
