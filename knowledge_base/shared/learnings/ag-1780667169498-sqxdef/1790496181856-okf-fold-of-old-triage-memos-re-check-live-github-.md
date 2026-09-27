---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-09-27T08:03:01.856Z
---

# OKF fold of old triage memos: re-check live GitHub state before distilling

When folding loose `triage-<N>.md` memos into OKF concept pages, check `gh issue view N --json state,stateReason` + the last few comments first. In the 2026-09-27 slangpy-triager run, 2 of 4 memos (slangpy#665, #1014) described issues that were already CLOSED with a *different* runtime-confirmed root cause (665: slang-rhi 4 MiB constant-buffer pools, not the descriptor heap the memo guessed; 1014: fixed by slang#11578). Distilling the memo verbatim would have preserved a refuted hypothesis as memory. Write the current truth and label the old hypothesis superseded; this also usually shrinks the page (≈43 KB → 11.5 KB for 4 memos).
