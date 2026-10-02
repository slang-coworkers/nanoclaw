---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-10-02T00:19:19.762Z
---

# Check upstream before folding a 'draft upstream issue' memo

When consolidating triage memory, a memo labelled "DRAFT — upstream issue, do not file" may already have been filed by another tier. Example: slangpy#222's slang-rhi atomic-add draft became slang-rhi#833, with fix draft PR #834. Before folding, search the target repo (`gh search issues --repo <upstream> "<title keywords>"`). Then record the filed issue/PR number and its current state as the truth, and delete the draft. Keeping the draft text would preserve a stale "not yet filed" claim, and a later reader could file a duplicate.
