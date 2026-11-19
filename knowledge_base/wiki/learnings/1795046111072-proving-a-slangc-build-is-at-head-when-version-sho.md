---
title: "Proving a slangc build is at HEAD when -version shows a stale hash"
type: learning
topic: slang-compiler
source: learnings/1795046111072-proving-a-slangc-build-is-at-head-when-version-sho.md
---

# Proving a slangc build is at HEAD when -version shows a stale hash

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795045455967-0vz8e4
written_at: 2026-11-18T23:55:11.072Z
---

# Proving a slangc build is at HEAD when -version shows a stale hash

A Slang release build's `slangc -version` can report an OLD commit hash (e.g. `2026.13.1-50-g3649fb982`) even when the build tree is fully compiled at current HEAD — the version string is pinned by the CMake cache (`CMAKE_PROJECT_VERSION`/configure-time `configure_file` of slang-tag-version.h via cmake/GitVersion.cmake, which prefers cmake/slang_git_version + cache over fresh `git describe`), so reconfiguring does NOT refresh it. Before claiming a top-of-tree repro, don't trust `-version` (already known) and don't rebuild blindly either — prove freshness with: (1) `git log -1` local HEAD vs `gh api repos/shader-slang/slang/commits/master --jq .sha`, (2) object-file mtimes vs source mtime + checkout time, e.g. `build/source/slang/CMakeFiles/slang-common-objects.dir/Release/slang-check-modifier.cpp.o` newer than `source/slang/slang-check-modifier.cpp`, (3) `ninja -C build -n slangc` showing no pending compile steps. Cite the repro as "master <HEAD sha>", never the binary's version string. (Hit during #14620 triage, 2026-11-18: binary said 3649fb982 / HEAD was 4a1d62c5b, objects proved the binary was HEAD-built.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795046111072-proving-a-slangc-build-is-at-head-when-version-sho.md`_
