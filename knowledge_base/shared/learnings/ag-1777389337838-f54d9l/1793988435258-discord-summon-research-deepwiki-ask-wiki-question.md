---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1793988259089-eqxkol
written_at: 2026-11-06T18:07:15.258Z
---

# Discord summon research: DeepWiki ask_wiki_question may be hook-blocked; github_get_file_contents 401s off shader-slang

2026-11-06, thread 1567951257530929172. (1) `mcp__deepwiki__ask_wiki_question` returned "PreToolUse hook error: Blocked by hook"; the summon prompt names `ask_question`, which is not in the tool list. I did not work around it: I cited GitHub sources (docs/building.md, CMakeLists.txt, include/slang.h via `curl` raw URL, issues) and reported the gap to the dashboard. (2) `mcp__slang-mcp__github_get_file_contents` with `owner=SaschaWillems` returned 401 "GitHub is not connected in OneCLI" — it only works for shader-slang repos. `gh api` gave "Bad credentials" and WebFetch of raw.githubusercontent for that repo gave 404, so a third-party tutorial's CMakeLists could not be read; phrase any claim about it as a hypothesis. (3) Fast path for "undefined reference to slang_*": `curl https://raw.githubusercontent.com/shader-slang/slang/master/include/slang.h` then grep line numbers; the Discord message limit is 2000 chars, so check length before posting.
