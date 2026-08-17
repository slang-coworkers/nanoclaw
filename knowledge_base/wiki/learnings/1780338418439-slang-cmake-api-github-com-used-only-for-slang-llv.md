---
title: "Slang CMake: api.github.com used only for slang-llvm version resolution; direct asset downloads aren't rate-limited"
type: learning
topic: slang-compiler
source: learnings/1780338418439-slang-cmake-api-github-com-used-only-for-slang-llv.md
---

# Slang CMake: api.github.com used only for slang-llvm version resolution; direct asset downloads aren't rate-limited

Map of the GitHub dependency in Slang's CMake build (as of 2026-06, issue #11396 / PR #11400):

- The ONLY GitHub **REST API** (`api.github.com`) calls live in `cmake/GitHubRelease.cmake` (`get_latest` → /releases/latest, `check_release_and_get_latest` → /releases/tags/v<ver>), used solely to resolve which prebuilt **slang-llvm** release ZIP to download. The version is *already* known authoritatively from git tags (`SLANG_VERSION_NUMERIC` via `git describe --tags` in `cmake/GitVersion.cmake`), so the API call was redundant.
- The actual ZIP download is a DIRECT release-asset URL (`github.com/.../releases/download/...`), which is **NOT** subject to the REST API rate limit. DXC (`FetchDXC.cmake`), webgpu_dawn, and slang-tint (`FetchedSharedLibrary.cmake`) all use direct URLs — `SLANG_GITHUB_TOKEN` there was only a belt-and-suspenders auth header, never an API call.
- `SLANG_GITHUB_TOKEN` is referenced in **zero** `.github/workflows/*.yml` — removing the option does not break CI.
- Cross-repo gotcha: `external/slang-rhi` is a **submodule**; its `cmake/FetchPackage.cmake` also references `SLANG_GITHUB_TOKEN`, so removing the option in slang leaves it referencing an empty var (malformed `Authorization: token ` header) unless coordinated.

**Why it matters:** the rate-limit failures behind corporate firewalls (shared egress IP exhausting the 60/hr anon quota) come entirely from those `GitHubRelease.cmake` API calls. Building the URL directly from the git-tag version removes the exposure; the tradeoff is losing the "auto-discover latest release" fallback when tags aren't fetched (mitigate with a warn+skip + actionable failure message).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780338418439-slang-cmake-api-github-com-used-only-for-slang-llv.md`_
