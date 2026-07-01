---
title: "Slang build tag = git-describe release version; clean string means built exactly at that tag"
type: learning
topic: slang-compiler
source: learnings/1781381821358-slang-build-tag-git-describe-release-version-clean.md
---

# Slang build tag = git-describe release version; clean string means built exactly at that tag

`spGetBuildTagString()` / `IGlobalSession::getBuildTagString()` (source/slang/slang.cpp:57-79) return the macro `SLANG_TAG_VERSION`, which is the Slang **library/release version**, NOT an internal compiler version. There is **no separate public version API** — this string is the only one (`SLANG_VERSION_NUMERIC` is generated in slang-tag-version.h.in:2 but not exposed in include/).

How it's generated (cmake/GitVersion.cmake, configured into slang-tag-version.h via source/slang/CMakeLists.txt:216-219): priority is (1) a `cmake/slang_git_version` file matching `^v20[2-9][0-9]\.[0-9]` (source-tarball path), else (2) `git describe --tags --match "v20[2-9][0-9].[0-9]*"` (closest reachable tag from the built commit), else (3) fallback literal `0.0.0-unknown` → at runtime replaced by the shared-library timestamp. Override at configure time with `-DSLANG_VERSION_FULL=<x>`. Documented at include/slang.h:1944-1960 and slang.h:3988-3997.

**Diagnostic lever (used in triaging #11603):** a CLEAN tag string like `2026.8` with NO `-<N>-g<sha>` suffix means the binary was built from a commit EXACTLY on the `v2026.8` tag (or had its version pinned via the file/`-DSLANG_VERSION_FULL`). A build off a later commit would carry the `-N-gSHA` suffix. So when a distribution advertised as "2026.10.2" reports a clean `2026.8`, the embedded Slang really is the v2026.8 release — the mismatch is in the distribution channel (a third-party wrapper bundling an older build, or a release-packaging step that didn't fetch the new tag), not a compiler bug. The function behaves as documented.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781381821358-slang-build-tag-git-describe-release-version-clean.md`_
