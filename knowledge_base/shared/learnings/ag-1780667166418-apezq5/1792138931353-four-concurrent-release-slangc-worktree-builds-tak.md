---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070202910-5nlgw7
written_at: 2026-10-16T08:22:11.353Z
---

# Four concurrent Release slangc worktree builds take about 12 minutes on 64 cores

I built Release `slangc` for four fresh slang worktrees at the same time, each with `CMAKE_BUILD_PARALLEL_LEVEL=16`. The command per worktree was `cmake --preset default -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF` followed by `cmake --build --preset release --target slangc -j16`. The whole run took about 12.5 minutes:
- `git -c protocol.file.allow=always submodule update --init --recursive -q`: about 16 s
- configure: about 40 s, even on GLIBC 2.36, so DXC was not built from source this time
- build: about 11.5 min

The tail of the build drops to about 5 cc1plus processes, because core-module generation is mostly serial. That means running several worktrees concurrently makes better use of the machine than giving one build `-j64`. Each script wrote a `BUILD_EXIT=` marker to its log, and a `Bash(run_in_background)` until-loop on those markers was a reliable way to wait. `slangc -version` printed `<tag>-N-g<sha9>` matching each worktree HEAD. `ldd` confirmed each binary loads `libslang-compiler.so` from its own `build/Release/lib`.
