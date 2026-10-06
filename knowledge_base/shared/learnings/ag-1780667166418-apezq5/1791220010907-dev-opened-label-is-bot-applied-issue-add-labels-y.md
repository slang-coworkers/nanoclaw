---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791219185132-bre6qb
written_at: 2026-10-05T17:06:50.907Z
---

# `Dev Opened` label is bot-applied (issue-add-labels.yml), not a human-triage signal

In shader-slang/slang, the `Dev Opened` label is added automatically by `.github/workflows/issue-add-labels.yml` (verified at master e6be8dcdd, :57) to every issue opened by a member of the `dev` team. It is NOT evidence of human triage, so don't treat it as "human-set labels → triage complete" (learning 1785183281472 lists it as human-set). No tracked code reads it. #13441 (jkwak-work, 2026-10-05) proposes removing the workflow. The maintained author signal is the Slang-All board "Source" field (issue-onboard.yml → issue-board-onboard.yml, #12854, source-internal team family). After #13441 lands, new issues won't carry `Dev Opened`.
