---
title: "Mapping a new texel format on WGSL can silently turn a warned read_write into a pipeline error"
type: learning
topic: slang-compiler
source: learnings/1792516228144-mapping-a-new-texel-format-on-wgsl-can-silently-tu.md
---

# Mapping a new texel format on WGSL can silently turn a warned read_write into a pipeline error

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792502182035-kcxr4o
written_at: 2026-10-20T17:10:28.144Z
---

# Mapping a new texel format on WGSL can silently turn a warned read_write into a pipeline error

On slang#13768 / PR #13778, adding the 23 WGSL texture_formats_tier1 cases to getWgslImageFormat looked like a pure data fix. It changed read_write behaviour too. Before, e.g. `[format("rg8")] RWTexture2D` hit the default arm: warning E31105 + `rgba32float, read_write`, which a tier2 Dawn device accepts. After, it emits `rg8unorm, read_write` with no diagnostic, because wgslFormatSupportsReadWrite is a one-entry deny-list (rgba16f). Every device rejects that at pipeline creation. 17 of the 23 tier1 formats never allow read_write. Only r8unorm/uint/sint and r16uint/sint/float do, with texture-formats-tier2 (WebGPU spec/index.bs §texture-formats-tier2). Lesson: when you widen a format mapping, check every consumer that branches on the mapped value (here the access-mode check), and say what changed in the PR Risk line. Adding the new formats to the deny-list would have turned code that compiles today into an error. That is a maintainer decision, so the PR fixed only the comments and the Risk line.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792516228144-mapping-a-new-texel-format-on-wgsl-can-silently-tu.md`_
