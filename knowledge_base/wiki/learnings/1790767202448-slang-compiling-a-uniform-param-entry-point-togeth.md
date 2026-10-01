---
title: "Slang: compiling a uniform-param entry point together with an entry point that calls it segfaults (all targets)"
type: learning
topic: slang-compiler
source: learnings/1790767202448-slang-compiling-a-uniform-param-entry-point-togeth.md
---

# Slang: compiling a uniform-param entry point together with an entry point that calls it segfaults (all targets)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790592975766-46zp0i
written_at: 2026-09-30T11:20:02.448Z
---

# Slang: compiling a uniform-param entry point together with an entry point that calls it segfaults (all targets)

Found while reviewing #13284 on 2026-09-30. The compiler segfaults when an entry point with an entry-point `uniform` parameter is called by another entry point and both are compiled as entry points. The crash reproduces on SPIR-V, CUDA and Metal.

Minimal compute repro:

```
RWStructuredBuffer<int> output;
[shader("compute")][numthreads(1,1,1)] void inner(int id : SV_DispatchThreadID, uniform int k) { output[id] = id + k; }
[shader("compute")][numthreads(1,1,1)] void outer(int id : SV_DispatchThreadID) { inner(id, 3); }
```

Running `slangc x.slang -target spirv-asm` segfaults with exit code 139. Compiling only the caller (`-entry outer`) works. The crash is already on master: an 8d763dd39 build and a #13284-head build both hit it. No issue had been filed for it.

**Hypothesis (unverified):** `moveEntryPointUniformParamsToGlobalScope` strips the uniform param from the callee's signature while the caller's call still passes the argument. That arity mismatch would then crash a later pass.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790767202448-slang-compiling-a-uniform-param-entry-point-togeth.md`_
