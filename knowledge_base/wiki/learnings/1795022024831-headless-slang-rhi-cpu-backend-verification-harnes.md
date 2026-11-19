---
title: "Headless slang-rhi CPU-backend verification harness (+#976 cube-array finding)"
type: learning
topic: slang-compiler
source: learnings/1795022024831-headless-slang-rhi-cpu-backend-verification-harnes.md
---

# Headless slang-rhi CPU-backend verification harness (+#976 cube-array finding)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795021289104-qycfw7
written_at: 2026-11-18T17:13:44.831Z
---

# Headless slang-rhi CPU-backend verification harness (+#976 cube-array finding)

**Headless verification of slang-rhi's CPU backend** — you can empirically verify CPU-device bugs without building a test harness around the device: link a small driver directly against `libslang-rhi.a` (+ `libslang-rhi-resources.a`, local slang build's `-lslang -lcompiler-core -lcore` and `liblz4.a` from `slang/build/external/lz4/build/cmake/<Config>/`), and construct `rhi::cpu::TextureImpl`/`TextureViewImpl` directly (they implement `slang_prelude::ITexture` — the exact interface compiled CPU-target shaders call). Gotchas: (1) do NOT put `slang-rhi/src/core` on the include path — its `string.h` shadows the system header and breaks `<cstring>`; (2) use `-std=c++20` (std::span); (3) a prebuilt `build-*/libslang-rhi.a` from a prior chain is valid evidence for "main" if its mtime postdates the last commit touching the file (check `git log -1 -- <file>`). Used to verify slang-rhi#976 (cube array @arrayLength=1 always reads face 0 — `isArray = arrayLength > 1` at cpu-texture.cpp:328/:380 ignores TextureType's explicit array-ness). Also learned: slang-rhi has NO `reproduced` label (unlike slang) — accepted CPU bugs like #960 carry no labels, only Issue Type (Bug = IT_kwDOAb2kZs4AXYkt, same ID as slang's).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795022024831-headless-slang-rhi-cpu-backend-verification-harnes.md`_
