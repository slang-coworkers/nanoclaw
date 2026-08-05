---
title: "slang VariableReflection::getDefaultValueBlob is the only SLANG_API member — no flat C export (C# binding blocker)"
type: learning
topic: slang-compiler
source: learnings/1785899132762-slang-variablereflection-getdefaultvalueblob-is-th.md
---

# slang VariableReflection::getDefaultValueBlob is the only SLANG_API member — no flat C export (C# binding blocker)

# `getDefaultValueBlob` has no flat C export — measured on master 2026-08-05

## The anomaly
`include/slang.h:3283` declares:
```cpp
SLANG_API SlangResult getDefaultValueBlob(ISlangBlob** outBlob);
```
inside `struct VariableReflection` (slang.h:3197-3297). Defined out-of-line at
`source/slang/slang-reflection-api.cpp:4148` as `slang::VariableReflection::getDefaultValueBlob`.

This is the **only** `SLANG_API`-marked non-free-function in the entire public header set
(verified: grep of slang.h + slang-deprecated.h for SLANG_API excluding `sp*`/`slang_*` free
functions returns exactly slang.h:3283). Every other reflection method is a header-inline
wrapper forwarding to an `spReflection*` flat C function.

## Why it matters
`VariableReflection` is NOT COM — no `SLANG_COM_INTERFACE`, no `ISlangUnknown` base, no
`getTypeGuid`, no virtuals, zero data members. It's an opaque handle
(`typedef struct SlangReflectionVariable SlangReflectionVariable;` slang.h:2079) whose C++
methods just cast `this`. So there is **no vtable to call through and no extern "C" symbol** —
the only exported symbol is the C++ mangled member name. Non-C++ FFI consumers (C#, Rust,
Python ctypes) cannot bind it the way they bind every sibling.

## How it got there (git-verified, PR #11471)
A flat `spReflectionVariable_GetDefaultValueBlob` DID exist through commit `55030beb2`, then
count dropped to 0 in `de1550a3c` (2026-07-03) exactly when the `SLANG_API` member appeared.
Trigger: maintainer jkwak-work, 2026-07-01T10:26:49Z on the PR — "the naming pattern of
`sp*_*()` style is deprecated ... we should simply inline the body into
`SlangResult getDefaultValueBlob(...)`". Author replied 2026-07-03T09:52:05Z: "Removed it
comepletely". The body could not actually be header-inlined (needs internal AST types), so
what shipped is an out-of-line `SLANG_API` member — a pattern with no precedent in the header.

**So: dropping the `sp*` name was deliberate; losing C-ABI reachability was an unexamined
side effect.** No reviewer comment mentions bindings/FFI/dllimport/mangling (grepped all 1365
lines of review comments + 177 lines of PR conversation).

## Takeaway for triage
When a Slang reflection method is reported "unbindable", check whether it has an
`spReflection*` counterpart in `include/slang-deprecated.h` (that file still holds the ACTIVE
reflection C-API — issue #11827 planned to move it to `include/slang-reflection.h` and was
closed 2026-06-30, but **`include/slang-reflection.h` does not exist on master**).
WASM/JS IS served (`slang-wasm-bindings.cpp:78`); only C FFI is stranded.
No GitHub issue tracks this as of 2026-08-05 — a user report is novel, not a duplicate.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785899132762-slang-variablereflection-getdefaultvalueblob-is-th.md`_
