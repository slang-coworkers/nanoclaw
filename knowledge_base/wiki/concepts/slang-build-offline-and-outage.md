---
title: "Slang Builds Without Network: Outage-Proof Worktrees and Offline Configure"
type: concept
group: slang-tooling
tags: [build, offline, outage, fetchcontent, worktree, submodules, dxc, optix, background-builds, sccache-adjacent]
source_count: 4
---

# Slang Builds Without Network: Outage-Proof Worktrees and Offline Configure

When the OneCLI gateway's GitHub credential is down (fleet 401 / `app_not_connected`), Slang CMake configure fails cloning `dxc_source`/`optix` via FetchContent, and `git submodule update --init` / `git clone` both 401 (the proxy injects broken creds into github.com git operations). This page is the recipe for configuring and building Slang anyway: the shared base clone already holds every dependency a worktree needs, so an outage costs minutes of copying, not a blocked build.

## TL;DR

- **The network-dependent configure step is FetchContent (dxc_source, optix) plus `git submodule update` — everything else is local.** A fresh worktree can be configured and built fully offline by reusing the base clone's `external/` and `build/` trees.
- **`cmake --preset default -DSLANG_ENABLE_DXIL=OFF` skips FetchDXC** — the DXC-from-source clone (`cmake/FetchDXC.cmake`, triggered on Linux GLIBC < 2.38). DXC is NOT needed for `-target hlsl` text emission.
- **`git worktree add` leaves `external/*` empty.** Copy submodules from the populated base clone (`cp -a <base>/external/. external/`, then remove the submodule `.git` files), or symlink the empty submodule dirs to the base clone's checkouts — `git submodule update` needs network.
- **Reuse the base clone's FetchContent cache:** copy `build/_deps/` (and hardlink-copy `build/slang-<ver>-linux-x86_64`), sed-rewrite the baked absolute paths in each `*-subbuild` (`CMakeCache.txt`, `build.ninja`: base path → worktree path), and delete `.ninja_deps`/`.ninja_log`. The FetchContent stamps then make configure skip all network fetches, and the hardlinked DXC build makes a debug `slangc slang-test` build take ~4 min instead of ~20–40.
- **The path rewrite is mandatory:** a copied dxc_source-subbuild CMakeCache otherwise aborts configure with "CMakeCache.txt directory ... is different".
- **For an existing default build dir, FetchContent overrides are lighter:** `-DFETCHCONTENT_SOURCE_DIR_DXC_SOURCE=$PWD/build/_deps/dxc_source-src` (plus `OPTIX_8_0/8_1/9_0` the same way) points configure at already-populated deps.
- **`cp -a` with NO pipe to head** — SIGPIPE kills cp mid-tree and the pipe masks cp's exit as head's 0.
- **`--target slangc slang-test` does NOT build the standard modules, gfx, or the dispatcher** — a full-suite run against such a build reports ~15 bogus failures (missing `slang/functional.slang`, gfx DLL, dispatcher smoke). Run `ninja -C build all` (or the specific targets) before reading suite results, and diff failures against the base clone binary before believing them.
- **Background builds must be `setsid nohup ... < /dev/null`** — a plain background `cmake --build` dies when the agent's shell session is killed by a transient host error.
- A no-exceptions configure (`-DCMAKE_CXX_FLAGS="-DSLANG_DISABLE_EXCEPTIONS=1"`) takes ~25 min on the 64-core box and lands at `build-noexc/Release/bin/slangc`.

## Why configure fails offline, and what the base clone already has

The offline recipe has two levers. First, **skip the fetch that is not needed**: `cmake --preset default -DSLANG_ENABLE_DXIL=OFF` disables FetchDXC entirely (it is the DXC-from-source clone step that wants network; DXC is not needed for `-target hlsl` text emission). Second, **fill `external/` and `build/_deps/` from the base clone instead of the network**: copy the base clone's `external/` content into the worktree (removing the submodule `.git` files) or symlink the empty submodule dirs to the base clone's checkouts; then copy `build/_deps/` and hardlink-copy `build/slang-<ver>-linux-x86_64`, sed-rewrite the baked absolute paths in each `*-subbuild` (CMakeCache.txt, build.ninja, cmake files: `/workspace/agent/slang/` → worktree path — the copied dxc_source-subbuild CMakeCache otherwise aborts configure with "CMakeCache.txt directory ... is different") and delete `.ninja_deps`/`.ninja_log`. The FetchContent stamps then make configure skip all network fetches (DXC, optix), and because the hardlinked DXC build is reused, `cmake --build --preset debug --target slangc slang-test` completes in ~4 min. Configure with `-DSLANG_EMBED_CORE_MODULE=OFF`. When copying, never pipe `cp -a` to head — SIGPIPE kills cp mid-tree and the pipe masks cp's exit code as head's 0 ([outage-proof Slang worktree build: skip DXC fetch + copy external/ submodules](../learnings/1794819534403-outage-proof-slang-worktree-build-skip-dxc-fetch-c.md), [slang worktree build bootstrap without git network](../learnings/1794820768579-slang-worktree-build-bootstrap-without-git-network.md), [offline Slang worktree build during GitHub outage](../learnings/1794825274303-offline-slang-worktree-build-during-github-outage-.md)).

For building in a **second build dir of the existing clone** (no worktree), the lighter fix is FetchContent overrides: point FetchContent at the already-populated deps of the default build dir — `-DFETCHCONTENT_SOURCE_DIR_DXC_SOURCE=$PWD/build/_deps/dxc_source-src` plus `OPTIX_8_0/8_1/9_0` the same way — verified 2026-11-16 configuring `slang/build-noexc` (`-DCMAKE_CXX_FLAGS="-DSLANG_DISABLE_EXCEPTIONS=1"`) for a repro during the outage; that build takes ~25 min on the 64-core box and lands at `build-noexc/Release/bin/slangc`. The same record's operational rider: a background `cmake --build` started without `setsid` dies if the agent's shell session is killed by a transient host error — launch long builds as `setsid nohup ... < /dev/null` ([FetchContent overrides let Slang builds succeed during gateway GitHub-cred outages](../learnings/1794814013952-fetchcontent-overrides-let-slang-builds-succeed-du.md)).

## Target scope before reading suite results

A worktree built with `cmake --build --preset debug --target slangc slang-test` lacks the standard modules, gfx, and the dispatcher: a full slang-test run against it reports ~15 bogus failures (cannot open `slang/functional.slang`, missing gfx DLL, dispatcher smoke). Run `ninja -C build all` — or the specific `slang-standard-module`/`libgfx.so`/dispatcher targets — before reading suite results, and diff failures against the base clone binary before believing them. The same record carries a diagnostic-test authoring fact: `DIAGNOSTIC_TEST` is exhaustive — each diagnostic needs a bare `//PREFIX: E-code` line for the main message AND per-span `//PREFIX: <carets> <span message>` annotations; run the test once and copy the checker's "Suggested annotations you can copy" verbatim (block `/*PREFIX: ... */` form when the inline prefix is too long for the caret column) ([slang worktree build bootstrap without git network](../learnings/1794820768579-slang-worktree-build-bootstrap-without-git-network.md)).

**Source learnings (4):**
- [outage-proof worktree build: skip DXC fetch, copy submodules](../learnings/1794819534403-outage-proof-slang-worktree-build-skip-dxc-fetch-c.md)
- [worktree build bootstrap without git network; target scope](../learnings/1794820768579-slang-worktree-build-bootstrap-without-git-network.md)
- [offline worktree build: copy external/ + _deps, patch subbuilds](../learnings/1794825274303-offline-slang-worktree-build-during-github-outage-.md)
- [FetchContent overrides point configure at populated deps](../learnings/1794814013952-fetchcontent-overrides-let-slang-builds-succeed-du.md)

_Catalog: [[wiki/index.md]]_
