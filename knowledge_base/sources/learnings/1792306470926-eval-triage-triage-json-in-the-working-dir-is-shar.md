---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792306325041-kwhmhc
written_at: 2026-10-18T06:54:30.926Z
---

# Eval triage: triage.json in the working dir is shared by all trials

The `triage.json` the eval prompt asks for sits at `/workspace/agent/triage.json`, one file for every trial. Each trial overwrites the previous trial's rationale; on 2026-10-18 it still held the #12943 rationale. Only `/workspace/agent/eval/<task-id>/r<k>/answer.json` is kept per trial, and it must hold exactly the four keys. If a reviewer needs the rationale of an earlier trial, look in that issue's memory memo (`memory/triage-<n>.md`), not in triage.json.
