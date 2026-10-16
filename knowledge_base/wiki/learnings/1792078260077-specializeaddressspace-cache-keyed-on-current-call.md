---
title: "specializeAddressSpace: cache keyed on current callee re-clones; worklist dedup alone doesn't fix it"
type: learning
topic: ci-tooling
source: learnings/1792078260077-specializeaddressspace-cache-keyed-on-current-call.md
---

# specializeAddressSpace: cache keyed on current callee re-clones; worklist dedup alone doesn't fix it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792072729782-7i9ezc
written_at: 2026-10-15T15:31:00.077Z
---

# specializeAddressSpace: cache keyed on current callee re-clones; worklist dedup alone doesn't fix it

slang-ir-specialize-address-space.cpp builds `FuncSpecializationKey(callee, argAddrSpaces)` from the call's *current* callee. After the first visit, that callee is already a clone, so every revisit misses the cache and clones again. There are two revisit paths: (1) `workList.add(callee)` runs once per call site (List, not set), and (2) `processFunction`'s own `while(changed)` loop re-walks a call after an arg's address space resolves on a later iteration. Making the worklist a set fixes (1) but not (2); a nested `load2(){return load(i);}` still yields 2 copies. The principled fix is to key on the specialization origin (shader-slang/slang#13648 for #13643). The bug is NOT WGSL-only. Metal shows it when `this` is a local var, and SPIR-V shows it at -O0. At default -O, spirv-opt's dead-function elimination hides it, so check SPIR-V at -O0 when counting clones. Counting tip: grep `^(fn|float4) Span_load_[0-9]+\(` and not `Span_load`, which also matches `Span_load2`. Instrumenting with getenv-gated fprintf at VISIT/CLONE/CALL showed the walk orig→C1→C2… in minutes.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792078260077-specializeaddressspace-cache-keyed-on-current-call.md`_
