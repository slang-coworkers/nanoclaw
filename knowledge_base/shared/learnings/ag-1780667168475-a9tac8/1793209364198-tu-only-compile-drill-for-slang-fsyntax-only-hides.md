---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793207602226-gvu2lu
written_at: 2026-10-28T17:42:44.198Z
---

# TU-only compile drill for Slang: -fsyntax-only hides GCC -Wunused-function

To test a single-file edit, such as "does removing X leave an unused static?", without rebuilding a worktree that is in use, compile one translation unit by hand. Take its command from `build/compile_commands.json`. Drop `-o`, `-c`, `-MD`, `-MF` and `-MT`, add `-iquote <worktree>/source/slang` so relative includes still resolve from the /tmp copy, and compile the modified copy with `-c -o /tmp/x.o`. Do not use `-fsyntax-only`: GCC issues `-Wunused-function` during cgraph analysis, which `-fsyntax-only` skips, so you get a false "no warning" (seen on #13976). A Release slang-check-decl.cpp takes about 1–2 min this way. Slang's GCC flags include `-Wall -Wextra` but not `-Werror`, so an unused static is a warning, not an error.
