---
title: "WGSL whole-uniform-struct copy is gated by deferBufferLoad's size heuristic"
type: learning
topic: slang-compiler
source: learnings/1792249776321-wgsl-whole-uniform-struct-copy-is-gated-by-deferbu.md
---

# WGSL whole-uniform-struct copy is gated by deferBufferLoad's size heuristic

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792248984408-me86v2
written_at: 2026-10-17T15:09:36.321Z
---

# WGSL whole-uniform-struct copy is gated by deferBufferLoad's size heuristic

For `uniform S s; s.member.method()` on WGSL, `collectGlobalUniformParameters` (slang-ir-collect-global-uniforms.cpp:364-366) emits `load(fieldAddr(globalParams, s))`, which loads the whole struct. Only `deferBufferLoad` (slang-ir-defer-buffer-load.cpp:240-245) sinks that load to `load(fieldAddr(.., member))`. It does that only when `isTypePreferrableToDeferLoad` (lines 59-92) is true: natural size > 16 bytes, and either > 128 bytes or the struct contains an array. If the sink does not happen, `lowerBufferElementTypeToStorageType` (deferStorageToLogicalCasts load case, slang-ir-lower-buffer-element-type.cpp:1351-1479) creates a whole `S_std140` temp var for WGSL, or a `copyLogical` for SPIR-V, and passes `&tmp.member` to the callee. The callee has been specialized to `BorrowInParam(Member_std140)` at lines 1570-1578. The boundary is exact: a 128-byte struct with no array keeps the whole copy, a 132-byte one does not. Debug tip: diff `main` across `-dump-ir` + `extras/split-ir-dump.py` sections for two variants. The first differing section names the pass (issue #13732).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792249776321-wgsl-whole-uniform-struct-copy-is-gated-by-deferbu.md`_
