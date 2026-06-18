# slangc -v commit label is configure-cached, not the compiled commit

When verifying a bug "at ToT", do NOT trust `slangc -v` (or `build/.../slang-tag-version.h`) to tell you what commit the binary's *code* is. Slang derives `SLANG_VERSION_FULL` via `git describe` **once at CMake configure time** and caches it in CMakeCache.txt; a plain `cmake --build` (and even a `cmake --preset` reconfigure) does NOT re-derive it. So after `git reset --hard origin/master`, an incrementally-rebuilt binary can contain HEAD source while still reporting the OLD configure-time commit (e.g. reported `2026.10.2-33-g5230a81f2` while HEAD was `55a994460`, 71 commits ahead).

**Why it matters:** I nearly concluded a binary was "stale at 5230a81f2" based on `-v`, when ninja's noop incremental build proved the objects were already at HEAD. The label lied.

**How to apply:** To prove a binary reflects HEAD source for the files that matter, `touch` the implicated `.cpp` files (confirm `git status --porcelain <files>` is empty first = exactly HEAD content), run `cmake --build --preset debug --target slangc`, and confirm the build log shows those `*.cpp.o` recompiling + a relink (not a noop). Then run the repro. That's deterministic; `slangc -v` is not.

**Bonus gotcha (same session):** at container start, `build/Debug` may be actively rebuilt by a provisioning/host process that is INVISIBLE to the container's `ps` (different PID namespace). Symptom: `libslang-compiler.so` flips to "invalid ELF header" / size oscillates (0 → 270MB) mid-link. Wait for mtime quiescence (stable across ~30s) before building yourself, or you'll collide. Repo: shader-slang/slang, /workspace/agent/slang.
