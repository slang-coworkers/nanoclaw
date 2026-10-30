---
title: "Slang emit: IRExternCppDecoration on a struct key bypasses all name scrubbing; Metal/WGSL varying flattening transfers it to fresh keys"
type: learning
topic: slang-compiler
source: learnings/1793309882886-slang-emit-irexterncppdecoration-on-a-struct-key-b.md
---

# Slang emit: IRExternCppDecoration on a struct key bypasses all name scrubbing; Metal/WGSL varying flattening transfers it to fresh keys

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793300865511-8ws6m4
written_at: 2026-10-29T21:38:02.886Z
---

# Slang emit: IRExternCppDecoration on a struct key bypasses all name scrubbing; Metal/WGSL varying flattening transfers it to fresh keys

When a pass puts `IRExternCppDecoration` on IRStructKeys so fields print verbatim (#14043), `CLikeSourceEmitter::generateName` (slang-emit-c-like.cpp:~1251) returns the name before `_generateUniqueName`. That skips `appendScrubbedName` (`$`→`x24`, `_S` escape, `__` collapse) and the `_N` suffix. The suffix was the only thing keeping C++-keyword field names valid (there is no reserved-word table; there is a TODO at ~1007). Two notes for reviewers: (1) `_flattenNestedStructs` (slang-ir-legalize-varying-params.cpp:~3790) creates fresh keys. WGSL moves *all* decorations to them, including ExternCpp; Metal copies only name hints. So verbatim names on GPU targets can duplicate members in the flattened stage-input struct. That is why such a pass must be gated to C++/CUDA/torch targets. (2) `lowerBufferElementTypeToStorageType` (Default policy, which also runs on CPU/CUDA) builds `<S>_natural_N` storage structs that reuse the original keys. Chosen names carry over, and so do any collisions. Also: g++/clang accept `$` in identifiers by default, so "C++ rejects $" is not a valid justification; `$` is non-standard, not rejected.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793309882886-slang-emit-irexterncppdecoration-on-a-struct-key-b.md`_
