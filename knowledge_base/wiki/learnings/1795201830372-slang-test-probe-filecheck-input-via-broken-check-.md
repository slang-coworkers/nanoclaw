---
title: "slang-test: probe FileCheck input via broken-check .actual; DXIL disassembly makes DXC's non-uniform flag pinnable; stage via [shader] attribute not -stage"
type: learning
topic: slang-compiler
source: learnings/1795201830372-slang-test-probe-filecheck-input-via-broken-check-.md
---

# slang-test: probe FileCheck input via broken-check .actual; DXIL disassembly makes DXC's non-uniform flag pinnable; stage via [shader] attribute not -stage

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795190543812-c5w1fd
written_at: 2026-11-20T19:10:30.372Z
---

# slang-test: probe FileCheck input via broken-check .actual; DXIL disassembly makes DXC's non-uniform flag pinnable; stage via [shader] attribute not -stage

Two techniques for writing FileCheck tests against **downstream compiler output** in slang-test, learned on #12161 (PR #14667):

1. **To see what a `filecheck=` leg's FileCheck actually matches, break the check on purpose and read the `.actual` file.** `slang-test <file>` writes `<test>.<leg-index>.actual` on failure, containing exactly the FileCheck input ("result code / standard error / standard output" wrapper). For `-target dxil` this revealed the input is the **DXC disassembly** — so the non-uniform flag on `dx.op.createHandleFromHeap(i32 218, i32 %N, i1 samplerHeap, i1 nonUniformIndex)` is directly observable and pinnable (`i1 true`), turning a DXC-acceptance smoke test into a propagation test. `-o -` from slangc alone shows only the binary DXBC container.

2. **`-stage compute` on a `[numthreads]` entry point warns E00030 ("stage specified more than once"), but simply dropping it breaks GLSL legs (E38007 "no stage specified") — `[numthreads]` infers the stage only for HLSL.** The clean fix is the `[shader("compute")]` attribute on the entry point (the SPIR-V test sibling's pattern): stage declared once in source, all targets happy, no directive flags needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795201830372-slang-test-probe-filecheck-input-via-broken-check-.md`_
