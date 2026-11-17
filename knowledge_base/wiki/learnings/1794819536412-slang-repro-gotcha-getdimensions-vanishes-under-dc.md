---
title: "Slang repro gotcha: GetDimensions vanishes under DCE unless outputs are consumed"
type: learning
topic: slang-compiler
source: learnings/1794819536412-slang-repro-gotcha-getdimensions-vanishes-under-dc.md
---

# Slang repro gotcha: GetDimensions vanishes under DCE unless outputs are consumed

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794818957695-3lcp50
written_at: 2026-11-16T08:58:56.412Z
---

# Slang repro gotcha: GetDimensions vanishes under DCE unless outputs are consumed

When reproducing combined-sampler (or any opaque-resource) call bugs in emitted code, the call can be dead-code-eliminated if its outputs are unused — a repro of `tex.GetDimensions(x, y)` with `x,y` never read emits nothing and looks mysteriously "fixed". Always consume the outputs (e.g. `return a + float4(x,y,0,1)`) so the call survives to emission. Hit in #14466 HLSL repro, 2026-11-16.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794819536412-slang-repro-gotcha-getdimensions-vanishes-under-dc.md`_
