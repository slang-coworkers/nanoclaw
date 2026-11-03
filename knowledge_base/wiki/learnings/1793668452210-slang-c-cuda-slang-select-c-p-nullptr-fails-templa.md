---
title: "Slang C++/CUDA `_slang_select(c, p, nullptr)` fails template deduction — name T from the IR result type"
type: learning
topic: slang-compiler
source: learnings/1793668452210-slang-c-cuda-slang-select-c-p-nullptr-fails-templa.md
---

# Slang C++/CUDA `_slang_select(c, p, nullptr)` fails template deduction — name T from the IR result type

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793657061973-qcgux1
written_at: 2026-11-03T01:14:12.210Z
---

# Slang C++/CUDA `_slang_select(c, p, nullptr)` fails template deduction — name T from the IR result type

Context: slang#14059 / PR #14219. After the frontend accepted `select(c, p, nullptr)`, the C++/CUDA emitter printed `_slang_select(c, p, nullptr)`. `template<T> T _slang_select(bool, T, T)` then sees `int*` vs `std::nullptr_t`, and clang and nvrtc both reject it. This was already broken on master through the `select(c, p, (int*)nullptr)` workaround, because the cast folds into a typed null PtrLit that is still printed as bare `nullptr`.

Fix that worked: in `CPPSourceEmitter::tryEmitInstExprImpl` kIROp_Select, emit `_slang_select<emitType(result)>(...)` when the condition is not an IRVectorType. Vector conditions keep deduction, because CUDA's vector `_slang_select(boolN, ...)` overloads are non-templates and explicit template args would skip them.

Rejected approach: printing every null PtrLit as `static_cast<T*>(nullptr)`. A null `Ptr<void>` (`getNullVoidPtrValue`) is the IR's type-erased null: `nullptr` literal lowering and the `[DllImport]` function-pointer global initializer both use it. IR constants are deduped by type, so a user's void* null is the same inst. The cast broke 3 cpu-program DllImport tests, and exempting void left `select(c, voidPtr, nullptr)` broken.

Two more gotchas:
- `__getAddress(RWStructuredBuffer[i])` is a LOGICAL SPIR-V pointer. Storing it and a null into one slot gives E58003 even with plain if/else on master. For a physical pointer test, use `uniform int* p;` with `//TEST_INPUT: set p = ubuffer(data=[...], stride=4)`.
- In some containers `clang-format` is not on PATH, and `extras/formatting.sh` then silently skips C++ (its exit status stays 0 unless you check its output). Symlink `/usr/bin/clang-format-17` into PATH first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793668452210-slang-c-cuda-slang-select-c-p-nullptr-fails-templa.md`_
