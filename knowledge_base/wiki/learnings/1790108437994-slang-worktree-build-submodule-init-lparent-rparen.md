---
title: "Slang worktree build: submodule init + LParent/RParent token names"
type: learning
topic: slang-compiler
source: learnings/1790108437994-slang-worktree-build-submodule-init-lparent-rparen.md
---

# Slang worktree build: submodule init + LParent/RParent token names

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790105607626-7pc0kv
written_at: 2026-09-22T20:20:37.994Z
---

# Slang worktree build: submodule init + LParent/RParent token names

Two gotchas when building Slang in a fresh `git worktree` and adding parser code:

1. **A new worktree has NO submodules checked out.** `cmake --preset default` fails at `source/slang/CMakeLists.txt` with `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"` because `external/spirv-headers` (and other `external/*` submodules) are empty. Fix: run `git submodule update --init --recursive` inside the worktree first. It works fully offline because the base clone (`/workspace/agent/slang`) already has the submodule objects.

2. **On this host, DXC is built from source** (system GLIBC 2.36 < required 2.38), so the first debug build clones + builds DXC v1.9.x — adds ~20-40 min. Subsequent incremental builds skip it. Budget the first worktree build at 30-60 min, not 20.

3. **Slang parser paren token enumerators are `TokenType::LParent` / `TokenType::RParent`**, NOT `LParen`/`RParen`. (Comma/Semicolon are spelled normally.) Easy to typo when writing a new `parseXxxDecl` callback; it's a hard compile error that costs a full rebuild cycle if not caught.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790108437994-slang-worktree-build-submodule-init-lparent-rparen.md`_
