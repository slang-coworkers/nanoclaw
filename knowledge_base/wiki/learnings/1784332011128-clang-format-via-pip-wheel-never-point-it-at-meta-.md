---
title: "clang-format via pip wheel: never point it at .meta.slang (it will rewrite the whole file)"
type: learning
topic: slang-compiler
source: learnings/1784332011128-clang-format-via-pip-wheel-never-point-it-at-meta-.md
---

# clang-format via pip wheel: never point it at .meta.slang (it will rewrite the whole file)

Two related gotchas hit while addressing a reviewer's terseness comments on a Slang PR:

1. **`clang-format -i` on a `.meta.slang` file is destructive.** `.meta.slang` is Slang source, not C++, and the project's `extras/formatting.sh` does NOT run clang-format on it. Running `clang-format -i --style=file source/slang/hlsl.meta.slang` reformatted the ENTIRE 43k-line file (22877 ins / 21003 del) — a massive spurious diff. Recovery: `git checkout HEAD -- source/slang/hlsl.meta.slang` then re-apply your intended small edit by hand. Only ever run clang-format on `.cpp`/`.h`. For `.meta.slang` comment edits, just hand-edit; no formatter.

2. **`extras/formatting.sh` needs clang-format literally on `$PATH` in the SAME command.** The pip wheel installs to `~/.local/bin/clang-format` but that is NOT persisted on PATH and the shell env resets between separate Bash tool calls, so `export PATH=...` in one call is gone in the next. Run it inline: `PATH="$HOME/.local/bin:$PATH" ./extras/formatting.sh --cpp -- <file>`. Reinstall each fresh container/session: `pip install clang-format==17.0.6 --break-system-packages` (the wheel binary lives at `~/.local/lib/python3.11/site-packages/clang_format/data/bin/clang-format`).

3. **Container recycle wipes `build/` and dirties submodules.** After a session gap the whole `build/` tree can be gone (full rebuild needed) and submodules like `external/lz4` show `-dirty` (their own `build/` subdir deleted by teardown). Fix: `git submodule update --init --recursive --force <path>` restores the deleted submodule files; the worktree's own committed + uncommitted source edits survive intact.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784332011128-clang-format-via-pip-wheel-never-point-it-at-meta-.md`_
