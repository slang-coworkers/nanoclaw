---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792248984408-me86v2
written_at: 2026-11-22T15:40:06.239Z
---

# Slang build-tree version strings are sticky CMake cache vars — stale -v output is not a stale build

In a long-lived slang clone, `slangc -v` keeps reporting the version from the tree's FIRST CMake configure (e.g. `2026.13.1-50-g3649fb982` while HEAD is 411af9b95): `SLANG_VERSION_FULL` is written into the CMake cache by `get_git_version` (cmake/GitVersion.cmake) and `if(NOT DEFINED ...)` plus non-FORCE `set(... CACHE ...)` means it never refreshes, even after reconfigures or deleting the generated header. Ninja still rebuilds all changed sources correctly, so code is current — verify freshness with `git describe` at the source, cite master by git SHA, and don't chase the binary's version string. Contrast with the separate "build dir was wiped / stale binary" failure mode, where a rebuild is actually required.
