---
title: "CUDA struct/interface returns: Slang emits per-field writes only for store(MakeStruct), never for return — single local result is the source-level route"
type: learning
topic: slang-compiler
source: learnings/1790318832645-cuda-struct-interface-returns-slang-emits-per-fiel.md
---

# CUDA struct/interface returns: Slang emits per-field writes only for store(MakeStruct), never for return — single local result is the source-level route

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318106721-dgika6
written_at: 2026-09-25T06:47:12.645Z
---

# CUDA struct/interface returns: Slang emits per-field writes only for store(MakeStruct), never for return — single local result is the source-level route

From #13266 triage (2026-09-25, master 6eb89786c).

NVRTC can give smaller SASS when a tagged-union/interface result is built as a common exit plus separate field writes, instead of early `return {tag, payload}` or common exit with aggregate assignment. The C++ forms are semantically equivalent.

What Slang emits:
- Early returns emit `T _S = {a,b}; return _S;`: MakeStruct is a brace-init temp (slang-emit-c-like.cpp:2977-2992).
- `simplifyForEmit` `processMakeStruct` (slang-ir-simplify-for-emit.cpp:32-62) splits only `store(ptr, MakeStruct)` into field stores. It never splits `return(MakeStruct)`.
- Phi elimination stores each predecessor's value into the struct-param temp (slang-ir-eliminate-phis.cpp:1053). So a single local `result` assigned in every branch plus one `return` emits `(&r)->f0 = ..; (&r)->f1 = ..; return r;`, the NVRTC-friendly shape. This holds only if each branch's value is a visible MakeStruct; an opaque call result stays `r = _S;`.
- Nothing on the CUDA path merges returns. `convertFuncToSingleReturnForm` (slang-ir-single-return.cpp) exists, but only GLSL hull and reverse autodiff call it. It is the natural hook if a maintainer ever wants CUDA canonicalization.

Caveat: an else-if ladder whose inner branches cover fewer concrete types gets a narrower inner tagged union (smaller AnyValueN). That union is repacked (pack, then unpack) at the outer merge.

Diagnostic trick: to tell NVVM from ptxas, compare the PTX between variants. The reporter's modes 0/1/2 had byte-identical PTX while mode 3 differed, so the sensitivity is in NVRTC/NVVM. The local CUDA 12.6 toolkit at /usr/local/cuda (libnvrtc.so, ptxas, nvdisasm) can run such NVRTC repros. It has no sm_120, so use sm_75/89/90 and label the results as unqualified.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790318832645-cuda-struct-interface-returns-slang-emits-per-fiel.md`_
