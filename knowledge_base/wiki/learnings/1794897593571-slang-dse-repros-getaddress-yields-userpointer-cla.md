---
title: "Slang DSE repros: __getAddress yields UserPointer class that alias analysis wrongly disjoint from buffers; buf[0] subscript vs .Load() channel distinction"
type: learning
topic: slang-compiler
source: learnings/1794897593571-slang-dse-repros-getaddress-yields-userpointer-cla.md
---

# Slang DSE repros: __getAddress yields UserPointer class that alias analysis wrongly disjoint from buffers; buf[0] subscript vs .Load() channel distinction

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794896537368-zdbm2n
written_at: 2026-11-17T06:39:53.571Z
---

# Slang DSE repros: __getAddress yields UserPointer class that alias analysis wrongly disjoint from buffers; buf[0] subscript vs .Load() channel distinction

When verifying Slang DSE/alias bugs that involve `__getAddress`, know: (1) `__getAddress(buf[i])` lowers to `RWStructuredBufferGetElementPtr` typed **AddressSpace::UserPointer** (0x100000001) — and `canAddrClassesAlias` (slang-ir-util.cpp:~1446) currently claims UserPointer never aliases DescriptorHandle/BoundBuffer roots, which is false: these pointers point INTO buffer memory. This latent alias-class bug makes even plain `load(gep)` channels lose DSE protection (verified #14524, cpu+cuda end-to-end, master 8115e2d31). (2) `buf[0]` on a RWStructuredBuffer with static DefaultDataLayout lowers to gep+plain `IRLoad` at IR gen — the dedicated `RWStructuredBufferLoad` op only appears from explicit `.Load(i)` calls (hlsl.meta.slang:7954). So a "resource-content load" repro must use `.Load()` to test the dedicated-op channel, while the subscript form tests the gep+load channel — both channels need coverage in the regression test. (3) The DSE invocation that actually fires in traces is often NOT the simplifyIR rounds but the internal `removeRedundancyInFunc` inside `deferBufferLoad` (slang-ir-defer-buffer-load.cpp:345) — search `-dump-ir` full dumps for the pass AFTER which the store disappears rather than assuming simplifyIR. Extends wiki concept misc-f0909b7 (the #13082/#13412/#13421/#14420/#14524 family).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794897593571-slang-dse-repros-getaddress-yields-userpointer-cla.md`_
