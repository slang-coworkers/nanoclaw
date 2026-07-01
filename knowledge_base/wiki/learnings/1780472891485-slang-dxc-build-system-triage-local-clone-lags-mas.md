---
title: "Slang DXC/build-system triage: local clone lags master; verify FetchDXC against upstream via gh api"
type: learning
topic: slang-compiler
source: learnings/1780472891485-slang-dxc-build-system-triage-local-clone-lags-mas.md
---

# Slang DXC/build-system triage: local clone lags master; verify FetchDXC against upstream via gh api

When triaging DXC / `SLANG_DXC_*` / `cmake/FetchDXC.cmake` issues in shader-slang/slang, **do not trust the local mounted clone's line numbers or even file structure** — the DXC CMake machinery is being actively rewritten and the clone can lag master by days.

Concrete (triaging #11441 on 2026-06-03): local clone HEAD was `b305a4df4` (2026-05-29) with a 136-line `FetchDXC.cmake` that only had prebuilt-URL + override logic — **no source-build branch at all**. Upstream master's `FetchDXC.cmake` was already **876 lines** with GLIBC auto-detection, source-build, cross-compile, and Darwin branches. The rewrite landed in:
- #10935 (MERGED 2026-06-02) — GLIBC auto-detect + build-from-source fallback.
- #11434 (MERGED 2026-06-03) — source-built DXC on macOS.
- #11439 (OPEN) — source-built DXC by *default* on macOS.

**How to verify the real current file without a full fetch/rebuild:**
`gh api repos/shader-slang/slang/contents/cmake/FetchDXC.cmake --jq '.content' | base64 -d > /tmp/x.cmake` then grep it. Cheap, exact, no clone update needed. Always cite line numbers from the upstream copy, not the local clone, in triage memos/comments.

**Reusable structural facts (master, early June 2026):** `FetchDXC.cmake` ≈ decision cascade (~109-460) → source-build block (~463-755) → prebuilt-staging block (~757-876). Staging loops iterate `dxcompiler dxil` UNCONDITIONALLY on Linux/Darwin, so any path lacking `libdxil` (e.g. a system DXC) must avoid *creating* the `copy-dxil` target. `tools/CMakeLists.txt` lists `copy-dxcompiler`/`copy-dxil`/`stage-dxc-headers` under **OPTIONAL_REQUIRES** for slang-test → a missing copy target is tolerated, so new DXC-acquisition paths integrate without editing slang-test wiring. All Find modules (FindNVAPI/FindAftermath/FindOptiX) use plain `_INCLUDE_DIRS`/`_LIBRARIES` cache vars; none use IMPORTED targets.

**Also:** the `Agent` (fork) tool is unavailable inside an already-forked worker ("Fork is not available inside a forked worker") — in that mode do the recall scan + research reads directly with Grep/Read/Bash rather than spawning subagents.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780472891485-slang-dxc-build-system-triage-local-clone-lags-mas.md`_
