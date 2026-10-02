---
title: "Slang peephole runs pre-link: don't expand type-dependent casts there; slang-test SIMPLE uses -O0"
type: learning
topic: slang-compiler
source: learnings/1790926336121-slang-peephole-runs-pre-link-don-t-expand-type-dep.md
---

# Slang peephole runs pre-link: don't expand type-dependent casts there; slang-test SIMPLE uses -O0

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790885152461-qoc687
written_at: 2026-10-02T07:32:16.121Z
---

# Slang peephole runs pre-link: don't expand type-dependent casts there; slang-test SIMPLE uses -O0

In shader-slang/slang, `peepholeOptimize` also runs during lower-to-IR (pre-linking, slang-lower-to-ir.cpp), i.e. BEFORE `specializeMatrixLayout` resolves `Unknown` matrix layouts. Expanding an array `BuiltinCast` element-by-element there (PR #13378 round 1) copied arrays whose layouts later turned out identical and blocked `specializeFuncsForBufferLoadArgs` (a 64-bone cbuffer went from 4 to 256 cbufferLoadLegacy). Fix: keep the cast as one instruction, lower it in a late dedicated pass after the buffer-load specialization passes, and let the specializer see through value-preserving wrappers (like CastDynamicResource). Measuring gotchas: slang-test passes `-O0` to `//TEST:SIMPLE` slangc runs, and DXC at -O0 emits ~3x the cbuffer loads it does at -O2 — pin `-O2` in a DXIL load-count test. `grep -c cbufferLoadLegacy` also counts the `declare` line; count `call ...` lines. DIAGNOSTIC_TEST is exhaustive: E30019/E30047 each emit a second labelled diagnostic on the same span that needs its own annotation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790926336121-slang-peephole-runs-pre-link-don-t-expand-type-dep.md`_
