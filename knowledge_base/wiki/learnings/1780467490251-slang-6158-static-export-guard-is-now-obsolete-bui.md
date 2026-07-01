---
title: "Slang #6158 static-export guard is now obsolete (BUILD_LOCAL_INTERFACE wrapping)"
type: learning
topic: slang-compiler
source: learnings/1780467490251-slang-6158-static-export-guard-is-now-obsolete-bui.md
---

# Slang #6158 static-export guard is now obsolete (BUILD_LOCAL_INTERFACE wrapping)

**Context:** shader-slang/slang#11359 — the `if(NOT ${SLANG_LIB_TYPE} STREQUAL "STATIC")` guard around `install(EXPORT SlangTargets)` in `CMakeLists.txt` (added by PR #6158 to work around #5821) is **no longer needed at top-of-tree**.

**Why:** `slang_add_target` now wraps `LINK_WITH_PRIVATE` deps in a build-only generator expression — `cmake/SlangTarget.cmake:433-444`: `$<BUILD_LOCAL_INTERFACE:...>` on CMake ≥3.26, `$<BUILD_INTERFACE:...>` on older. Both strip the internal targets (`core`, `prelude`, `compiler-core`, `slang-capability-*`, `slang-lookup-tables`, `SPIRV-Headers`, `slang-common-objects`) from `slang`'s **install/export** link interface, so `install(EXPORT)` no longer requires them in any export set — which was the exact #5821 precondition. (Note: `slang-reflect-headers` from the original #5821 list no longer exists.)

**Second, separate bug the guard masks:** `slangConfig.cmake` (from `cmake/SlangConfig.cmake.in`) unconditionally `include()`s `slangTargets.cmake`, but the STATIC path never installs that file → `find_package(slang)` of a static install fails with a confusing "file not found." Removing the guard fixes this too.

**How to verify an "is not in any export set" fix cheaply (general CMake technique):** the check is a **GENERATE-time** diagnostic — no build needed. `cmake -S . -B <tmp> -DSLANG_LIB_TYPE=STATIC` with the guard removed; "Generating done" + exit 0 with no "not in any export set" error == fixed. A 10-line standalone repro nails the mechanism: a STATIC lib that does `target_link_libraries(foo PRIVATE bar)` + `install(TARGETS foo EXPORT ...)` + `install(EXPORT ...)` ERRORS at configure when `bar` is unexported, but PASSES when wrapped as `$<BUILD_INTERFACE:bar>`.

**Trap when bisecting in this clone:** the mounted slang checkout is a **shallow clone (~305 commits, grafted)**, so `git log -S "<string>"` misattributes — it lands on a graft-boundary commit (showed `--- /dev/null`, wrong PR subject). Don't cite a PR number found that way; rely on `git show origin/master:<file>` content instead.

**gh quirk:** `gh api user` returns HTTP 401 "GitHub is not connected in OneCLI" for nv-slang-bot, but `gh issue comment` posts fine — issue-comment write works even though the `user` endpoint scope doesn't.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780467490251-slang-6158-static-export-guard-is-now-obsolete-bui.md`_
