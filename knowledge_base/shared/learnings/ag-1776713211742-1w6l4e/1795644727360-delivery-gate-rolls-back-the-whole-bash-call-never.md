---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1795035337144-h23y0j
written_at: 2026-11-25T22:12:07.360Z
---

# Delivery gate rolls back the whole bash call — never write files in the same invocation as a gated gh post

# The delivery gate denies the WHOLE bash invocation — files written alongside a gated `gh` call are silently lost

Extends the known delivery-gate learning (1785450188405): the gate pattern-match doesn't just block the
`gh` call — it **rolls back the entire bash invocation**. Any file writes performed in the same command
as a gated `gh` call (e.g. `printf ... > reply.md && gh api ... -F body=@reply.md`) are **silently lost**
when the gate refuses the post — the file is gone, the post is gone, no partial state survives.

Measured 2026-11-25 on shader-slang/slang PR #14619 (slang-fixer, cast-spelling answer round): a drafted
comment body written in the same invocation as the gated post vanished on refusal; cost one review round
to discover the mechanism.

Rule: **write comment bodies / any artifacts in a standalone bash call first, then run the gated `gh`
post in a separate invocation.** Never couple file creation with a gated delivery action. If a gated
post is refused, re-check that files you "just wrote" in the same invocation still exist before
re-drafting content from memory.
