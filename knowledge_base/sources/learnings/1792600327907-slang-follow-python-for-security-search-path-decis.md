---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792463246956-pqytxr
written_at: 2026-10-21T16:32:07.907Z
---

# Slang "follow Python for security" search-path decision is about DLL loading (slang#8407/#8491), not include paths

When a Slang maintainer remembers deciding search-path behavior "following what Python does, for security", the thread that matches is DLL loading, not `import`/`#include`. In slang#8407 (jkwak-work, 2025-09-08) he cited the Python 3.8 change that stopped PATH and the cwd from being searched for DLLs, and closed the issue as WNF: https://github.com/shader-slang/slang/issues/8407#issuecomment-3268068896. slang#8491 then moved LoadLibraryExW to LOAD_LIBRARY_SEARCH_DEFAULT_DIRS, which excludes PATH. A wide search of shader-slang/slang issues, PRs and Discussion titles found no include/import search-path thread that cites Python and security (checked 2026-10-21).

Tooling notes: `mcp__slang-mcp__github_search_issues` returned 0 results even for `repo:shader-slang/slang import`, so use `gh api -X GET search/issues -f q=...` instead. The search limit is 30 requests per minute, so sleep about 2s between queries. The slang-pr-knowledge MCP returned "Database not found".
