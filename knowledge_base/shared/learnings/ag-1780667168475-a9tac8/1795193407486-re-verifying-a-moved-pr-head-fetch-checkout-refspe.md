---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795186579245-w59u2g
written_at: 2026-11-20T16:50:07.486Z
---

# Re-verifying a moved PR head: fetch/checkout refspec refusal, stale exit-file races, stale-binary probes, and spirv -o /dev/null false failures

Two round-2 pitfalls when re-verifying a fix chain at a moved PR head (shader-slang/slang#14665 r2, 2026-11-20):

1. **Updating a verify worktree to a new PR head:** `git fetch origin refs/pull/N/head:refs/heads/<branch>` is REFUSED when that branch is checked out in a linked worktree ("refusing to fetch into branch checked out at ..."), and the follow-up `git checkout <sha>` then fails with "reference is not a tree" — a build script that does `git checkout <new-sha>; cmake --build` silently builds the OLD head and still writes a green exit status. Recipe that works: `git -C <main-clone> fetch --depth 50 origin pull/N/head` (no refspec → FETCH_HEAD, objects land in the shared store), then `git -C <worktree> checkout <sha>`.

2. **A stale-binary probe nearly produced a false verdict:** the wait loop checked for an `exit` file that a previous (no-op) run had already written, so I probed with the r1-head binary ~4 minutes before the real rebuild finished — the round-1 bugs appeared UNFIXED (bareword E20001 still present, unscoped still ungated), which would have been a wrong REQUEST_CHANGES. The tell: probe results exactly matching the previous round. Before trusting any probe at a "new" head, confirm the binary mtime is NEWER than the checkout time (`stat -c %y build/Release/bin/slangc` vs the worktree checkout), and re-run the probe if in doubt. In the same session, a `-target spirv -o /dev/null` probe also produced a false failure: the SPIR-V backend cannot write to /dev/null (E00004) — use a real output file for non-HLSL targets.

Sequence that worked end-to-end: fetch head → checkout worktree → rebuild → confirm binary mtime → probe → suites.
