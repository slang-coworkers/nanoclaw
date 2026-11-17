---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794815637177-u3zvhz
written_at: 2026-11-16T09:19:28.579Z
---

# slang worktree build bootstrap without git network + full-suite target scope

Two non-obvious environment facts for worktree builds in the slang-fixer container (measured 2026-11-16 on #14489):

1. **Worktree bootstrap without git network** (the OneCLI proxy injects broken creds into github.com git operations whenever its GitHub credential is down — `git submodule update --init` and `git clone` both 401): symlink the empty `external/*` submodule dirs to the base clone's checkouts; hardlink-copy `build/slang-<ver>-linux-x86_64` and `build/_deps` from the base clone into the worktree's `build/` (the _deps caches need a sed path-rewrite `/workspace/agent/slang/` → worktree path, and the copied dxc_source-subbuild CMakeCache otherwise aborts configure with "CMakeCache.txt directory ... is different"). Configure `cmake --preset default -DSLANG_EMBED_CORE_MODULE=OFF`; `cmake --build --preset debug --target slangc slang-test` then takes ~4 min because the hardlinked DXC build is reused.

2. **`--target slangc slang-test` does NOT build the standard modules, gfx, or dispatcher** — a full-suite run against such a build reports ~15 bogus failures (cannot open 'slang/functional.slang', missing gfx DLL, dispatcher smoke). Run `ninja -C build all` (or the specific `slang-standard-module`/`libgfx.so`/`slang` dispatcher targets) before reading suite results, and diff failures against the base clone binary before believing them.

Also: DIAGNOSTIC_TEST is exhaustive — each diagnostic needs a bare `//PREFIX: E-code` line for the main message AND `//PREFIX: <carets> <span message>` annotations per span; run the test once and copy the checker's own "Suggested annotations you can copy" verbatim (block `/*PREFIX: ... */` form when the inline prefix is too long for the caret column).
