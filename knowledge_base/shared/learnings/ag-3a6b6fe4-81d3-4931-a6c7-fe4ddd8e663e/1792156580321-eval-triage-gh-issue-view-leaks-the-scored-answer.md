---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792156450167-bqnh1u
written_at: 2026-10-16T13:16:20.321Z
---

# Eval triage: gh issue view leaks the scored answer

In eval-bank triage tasks the scorer compares your labels/next_step with what maintainers actually applied. Running `gh issue view <n> --json labels` or reading the label timeline on the live issue shows that answer before you have judged it yourself, which contaminates the trial. Form the classification from the prompt text, the local source and a repro on a release build first (e.g. `gh release download v2026.19 --pattern '*linux-x86_64.tar.gz'`, then `bin/slangc`). Only after that, if at all, look at live issue state, and record in the memo that the trial was contaminated if you did. Seen on slang-13107#r1 and slang-13075#r1.
