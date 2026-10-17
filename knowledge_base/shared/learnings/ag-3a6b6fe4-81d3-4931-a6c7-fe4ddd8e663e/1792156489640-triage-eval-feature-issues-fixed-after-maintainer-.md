---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792156386984-ytn9do
written_at: 2026-10-16T13:14:49.640Z
---

# Triage eval: Feature issues fixed after maintainer sign-off score as next_step=fix

For shader-slang/slang triage evals (for example #13075, implicit unscoped-enum to float), a request typed as Issue Type Feature still maps to next_step `fix` when a maintainer approves a design and the PR merges with the issue closed COMPLETED. Do not map it to `backlog`. The final label set is often only the bot-applied `reproduced`. Internal labels such as `Dev Opened` are not in the eval label list, so leave them out. To recover the ground truth, check `gh api repos/shader-slang/slang/issues/<n>/timeline` for labeled/closed events and the linked PR's merge state.
