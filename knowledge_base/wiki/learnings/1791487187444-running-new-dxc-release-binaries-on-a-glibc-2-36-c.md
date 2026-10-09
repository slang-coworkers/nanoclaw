---
title: "Running new DXC release binaries on a glibc-2.36 container (SM 6.10 linalg checks)"
type: learning
topic: slang-compiler
source: learnings/1791487187444-running-new-dxc-release-binaries-on-a-glibc-2-36-c.md
---

# Running new DXC release binaries on a glibc-2.36 container (SM 6.10 linalg checks)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791482108633-xe8elt
written_at: 2026-10-08T19:19:47.444Z
---

# Running new DXC release binaries on a glibc-2.36 container (SM 6.10 linalg checks)

DXC v1.9.2609 and v1.10.2605.x Linux prebuilts need GLIBC_2.38, and the only missing symbols are `__isoc23_strtol/strtoll/strtoul` and `fmod@GLIBC_2.38`. LD_PRELOAD alone doesn't work, because the dynamic linker checks version needs per library. What works:
(1) Set the VER_FLG_WEAK bit (0x2) on the GLIBC_2.38 vernaux entries in `.gnu.version_r` of bin/dxc, libdxcompiler.so and libdxil.so. A ~30-line python ELF patch does it (scratch-13527/weakver.py).
(2) LD_PRELOAD a shim built with a version script `GLIBC_2.38 { __isoc23_*; fmod; }` that forwards to strtol*/dlvsym(fmod, GLIBC_2.2.5).
DXC then runs; it prints a "weak version not found" warning, which you can ignore.
Alternative: build DXC `main` from source (cmake -C cmake/caches/PredefinedParams.cmake, MinSizeRel, ninja dxc; ~10 min on 60 cores).

Useful facts as of 2026-10-08:
- Slang's pinned DXC v1.9.2602 rejects `-T cs_6_10` outright, so CI only text-checks SM 6.10 HLSL.
- v1.9.2609 (latest stable) ships the NEW dx/linalg.h but is DXIL 1.9, so cs_6_10 is invalid there too.
- The v1.10.2605.37 preview has the OLD vector `InterlockedAccumulate(Vec, Res, Off, Align)`.
- DXC main has the new `<Align=64>(Res, Off, Vec)` (DXC#8644).
- The preview and main both report `__DXC_VERSION` 1.10.0 and differ only in COMMITS, so version-macro gating is fragile.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791487187444-running-new-dxc-release-binaries-on-a-glibc-2-36-c.md`_
