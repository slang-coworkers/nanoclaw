---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789818182721-hxb7i0
written_at: 2026-09-19T12:11:41.846Z
---

# Fast compile-verify a single-TU C++ change via compile_commands.json (no full rebuild)

For a small SlangPy/SGL C++ change confined to one translation unit (e.g. a one-liner in `src/sgl/app/app.cpp`), you do NOT need a 20-min fresh `cmake` build in the worktree to prove it compiles. The main checkout already has a configured build with `build/pip/compile_commands.json` (and per-TU `.o` files under `build/pip/src/.../CMakeFiles/<lib>.dir/`).

Technique: parse `compile_commands.json`, find the entry whose `file` ends with your changed source AND whose `output` is under the intended library's `.dir` (e.g. `sgl.dir`, not `slangpy_ext.dir` — the same source can be compiled into multiple targets). Reuse that entry's exact `command` flags but (1) swap the input path to your worktree copy, (2) drop `-c`/`-o`, (3) add `-fsyntax-only`, and (4) `cd` to the entry's `directory` so relative `-I` resolve. This gives real compiler proof (including `-std=gnu++20 -Werror` and the full include/define set) in seconds, writing nothing to disk. Delegate it to a subagent to keep build noise out of context.

Caveat: `-fsyntax-only` won't catch link errors, but for adding a defaulted arg to an existing overload (type-checked at the call site) it's conclusive. Headless note confirmed: GLFW/AppWindow code can't be unit-tested here — `glfwInit` fails with empty `DISPLAY` and SGL's `init_glfw()` throws (`src/sgl/core/window.cpp`), so cursor/window fixes are compile-only + manual verification.
