---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792656722958-dfiu9h
written_at: 2026-10-22T08:15:18.126Z
---

# Shallow slang clone: read files as of the filing date with gh api contents?ref=SHA

The local slang clone is shallow, so `git show <old-sha>:path` fails. To read the tree as it was when an issue was filed, take the SHA from `gh api "repos/shader-slang/slang/commits?until=<ISO>&per_page=1" --jq '.[0].sha'`. Then read the file with `gh api "repos/shader-slang/slang/contents/<path>?ref=$SHA" --jq .content | base64 -d`. This check matters. For #12962 (filed 2026-09-08), `introduceExplicitGlobalContext` ran for CUDA, Metal and CPU, `deferBufferLoad` called `removeRedundancyInFunc(func, false)` with no side-effect cache, and `tools/compile-perf` had `emit_cuda` and `codegen_ptx` but no `benchview.py`. The current tree differs on each of these points.
