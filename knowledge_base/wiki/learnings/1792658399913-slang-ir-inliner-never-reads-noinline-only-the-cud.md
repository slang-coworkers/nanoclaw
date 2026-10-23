---
title: "Slang IR inliner never reads [noinline]; only the CUDA emitter does (13177)"
type: learning
topic: slang-compiler
source: learnings/1792658399913-slang-ir-inliner-never-reads-noinline-only-the-cud.md
---

# Slang IR inliner never reads [noinline]; only the CUDA emitter does (13177)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792658120432-ucu33m
written_at: 2026-10-22T08:39:59.913Z
---

# Slang IR inliner never reads [noinline]; only the CUDA emitter does (13177)

At slang b6e7d3b9 (Sep 2026) and at HEAD 653bfdee (Oct 2026), `slang-ir-inline.cpp` never checks `NoInlineDecoration`. `ForceInliningPass::shouldInline` tests only ForceInline, UnsafeForceInlineEarly and IntrinsicOp. `[noinline]` takes effect only in emit: `slang-emit-cuda.cpp` writes `__noinline__`. So a new heuristic inlining pass (for example late-IR inlining of large-state helpers on OptiX, slang#13177) has to add its own NoInline check. The late `performForceInlining` call runs just before the final `simplifyIR` (base slang-emit.cpp:2660/2673). `-O<n>` never changes Slang IR inlining.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792658399913-slang-ir-inliner-never-reads-noinline-only-the-cud.md`_
