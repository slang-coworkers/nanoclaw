---
title: "macOS DXC-from-source Bad-CPU-type: pin CMAKE_OSX_ARCHITECTURES; NATIVE sub-build doesn't inherit it"
type: learning
topic: ci-tooling
source: learnings/1789420445233-macos-dxc-from-source-bad-cpu-type-pin-cmake-osx-a.md
---

# macOS DXC-from-source Bad-CPU-type: pin CMAKE_OSX_ARCHITECTURES; NATIVE sub-build doesn't inherit it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789417978795-ujguig
written_at: 2026-09-14T21:14:05.233Z
---

# macOS DXC-from-source Bad-CPU-type: pin CMAKE_OSX_ARCHITECTURES; NATIVE sub-build doesn't inherit it

**Context:** slang#13077 — on macOS 27 / Apple Silicon a default configure fails building vendored DXC from source: `clang-tblgen: Bad CPU type in executable` while generating `AttrPCHWrite.inc`.

**Root cause:** `cmake/FetchDXC.cmake` forwards `CMAKE_OSX_ARCHITECTURES` to the DXC sub-build **only when the parent already set it**, and Slang never defaults it. The vendored DXC ships an old LLVM/Clang tree with no Apple-Silicon arch detection, so with no arch pinned it builds its `clang-tblgen` x86_64; macOS 27 dropped Rosetta 2 → can't exec.

**Fix (PR #13079, Approach A):** in the Darwin forward block, when `CMAKE_OSX_ARCHITECTURES` is unset/empty, default it to the host arch (`CMAKE_APPLE_SILICON_PROCESSOR` else `CMAKE_HOST_SYSTEM_PROCESSOR`, normalized to arm64/x86_64) before forwarding. Append to `_dxc_forwarded_config_args` — do NOT `set()` the var, so the existing forward `foreach` doesn't double-forward. Guard on Darwin + unset only → inert for universal/cross (explicit arch) and non-Darwin.

**Two non-obvious gotchas:**
1. **Verify the failing tool's location from the build log before trusting a cross-build hypothesis.** The reporter's log showed `Built target clang-tblgen` in the MAIN build progress + a relative `../../../../../bin/clang-tblgen` path → it's the main build's tool, NOT a NATIVE host-tools sub-build. Pinning the top-level configure fixes it.
2. **DXC's `cmake/modules/CrossCompile.cmake` `llvm_create_cross_target_internal(NATIVE "" Release)` forwards only `CMAKE_BUILD_TYPE`, the generator, and `LLVM_TARGETS_TO_BUILD` — NOT `CMAKE_OSX_ARCHITECTURES`.** So if a NATIVE host-tools sub-build *were* the culprit, forwarding arch to the top-level configure would NOT reach it. (It wasn't the culprit here.)

**Validation:** CMake-only + hardware-gated → no `.slang` test; prove branch logic with a `cmake -P` harness (Darwin unset→host, universal/explicit forwarded once, Rosetta override, non-Darwin skipped), ship as draft PR, and @-mention the reporter to validate on macOS 27/Apple Silicon. Immediate user workaround: `-DCMAKE_OSX_ARCHITECTURES=arm64`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789420445233-macos-dxc-from-source-bad-cpu-type-pin-cmake-osx-a.md`_
