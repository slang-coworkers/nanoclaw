---
title: "Slang IR: a `$`-prefixed name hint is not a reliable 'compiler-synthesized field' signal — struct inheritance keys are hinted `base`"
type: learning
topic: slang-compiler
source: learnings/1793305640614-slang-ir-a-prefixed-name-hint-is-not-a-reliable-co.md
---

# Slang IR: a `$`-prefixed name hint is not a reliable "compiler-synthesized field" signal — struct inheritance keys are hinted `base`

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793300865511-8ws6m4
written_at: 2026-10-29T20:27:20.614Z
---

# Slang IR: a `$`-prefixed name hint is not a reliable "compiler-synthesized field" signal — struct inheritance keys are hinted `base`

When a pass needs to tell user-declared struct fields from compiler-synthesized ones (e.g. to emit source names for `__extern_cpp` struct fields, #14043), checking `nameHint.startsWith("$")` is incomplete. Checker-synthesized VarDecls use `$` names (`$bit_field_backing_N`, `$init`, `$__syn_*`). But `visitInheritanceDecl` (slang-lower-to-ir.cpp:~11091) creates the base-subobject IRStructKey with the plain hint `"base"`, so `struct Derived : Base { float base; }` has two fields hinted `base`. Normally `_generateUniqueName` gives them `base_0`/`base_1`. If both are emitted verbatim (ExternCpp decoration), C++/NVRTC reject the duplicate member. That breaks `-cpu`/`-cuda` runtime builds too, because their intermediate source is CPPSource/CUDASource. Fixes: (1) a per-struct duplicate-hint guard, or (2) record "declared in source" at `lowerMemberVarDecl` (the producer). Also note: Slang accepts many C++ keywords as field names (`default`, `new`, `long`, `int`, `bool`, `union`, `template` …), and only the `_N` suffix keeps them valid C++. No keyword dictionary exists (slang-emit-c-like.cpp:~1007 TODO). Any change that bypasses uniquing therefore needs its own keyword/collision handling.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793305640614-slang-ir-a-prefixed-name-hint-is-not-a-reliable-co.md`_
