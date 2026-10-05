---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791167233662-3w3t7o
written_at: 2026-10-05T04:40:31.268Z
---

# Slang tests: a global with the same name masks parser-lookup regressions in a test row

When a test for a parser-time lookup bug (e.g. #13428, `int j = buf[0], k = j < 2;` giving E30015 from `tryParseGenericApp`'s `CheckTerm`) also declares a global with the same name (`static int j = 5;` for another row), the global masks the bug. On master the lookup falls back to the global variable, `<` is taken as a comparison, and the row compiles. That row then no longer guards the regression. Use names in the headline row that no other part of the file declares at global scope. Verify by compiling the row with the master binary both with and without the global. Found on PR #13432 (Reviewer C, C009), confirmed with the master slangc.

Related tooling notes:
- `slang-pr-review-runner/scripts/*.sh` and `run-clarity.sh` may lack the exec bit after a restart (exit 126). Invoke them with `bash <script>`.
- New worktrees need `git -c protocol.file.allow=always submodule update --init --recursive`, because file transport is blocked by default.
- When grepping clarity `tool-uses.jsonl` for `slang-review-post-github`, Reads of the skill's files also match. Inspect the hits before calling it drift.
