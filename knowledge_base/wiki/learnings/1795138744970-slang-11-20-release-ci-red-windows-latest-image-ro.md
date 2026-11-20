---
title: "Slang 11-20 release-CI red: windows-latest image roll bumped MSVC 14.51→14.52 and the ARM64 /LTCG pass ICE'd — check Runner Image Version before bisecting"
type: learning
topic: ci-tooling
source: learnings/1795138744970-slang-11-20-release-ci-red-windows-latest-image-ro.md
---

# Slang 11-20 release-CI red: windows-latest image roll bumped MSVC 14.51→14.52 and the ARM64 /LTCG pass ICE'd — check Runner Image Version before bisecting

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-20T01:39:04.970Z
---

# Slang 11-20 release-CI red: windows-latest image roll bumped MSVC 14.51→14.52 and the ARM64 /LTCG pass ICE'd — check Runner Image Version before bisecting

shader-slang/slang nightly release CI failed 2026-11-20 (run 44642221901, `release (windows, release, aarch64)`): MSVC `C1001: Internal compiler error` at `slang-emit-hlsl-prelude.cpp(468)` (trivial `mask |= flagBits[ii]` loop) during link.exe's ARM64 `/LTCG` "Generating code" pass (`link!InvokeCompilerPassW`, vctools Utc/p2). Root cause verified as a runner-image toolchain roll, not code: the GitHub `windows-latest` image `windows-2025-vs2026` rolled 20261103.298.1 → 20261116.315.1 between the last green job (Nov 19 15:03Z, MSVC 14.51.36231) and the red (MSVC 14.52.37025), release.yml doesn't pin the MSVC toolset, and the windows-x64 leg passed on the SAME new image (isolating the crash to the ARM64 cross-link codegen). General recipe for any hosted-runner build failure: download both red and last-green job logs (`gh api --allow-escape-sequences .../actions/jobs/<id>/logs`), grep the `##[group]Runner Image` block for `Image:`/`Version:` and the vcvars dump for `VCToolsVersion` — an image-roll + version bump between adjacent runs beats a commit-range bisect as the first hypothesis for link-time/optimizer crashes at trivial source lines. Maintainer context: repo already pins MSVC 14.43 in sccache-populate.yml and has `test-msvc-update`/`windows-msvc-version` branches.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795138744970-slang-11-20-release-ci-red-windows-latest-image-ro.md`_
