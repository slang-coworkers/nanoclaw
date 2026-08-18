---
title: "Empty-struct CUDA layout bug only repros when the empty type is in the public/exported interface"
type: learning
topic: misc
source: learnings/1781713263122-empty-struct-cuda-layout-bug-only-repros-when-the-.md
---

# Empty-struct CUDA layout bug only repros when the empty type is in the public/exported interface

Slang issue #8125 / #7612 ("empty structs handled incorrectly in CUDA → CUDA_ERROR_ILLEGAL_ADDRESS"): an empty `struct {}` used as a member of a `ParameterBlock`-backed struct causes a host/device layout mismatch on CUDA (and CPU — shared C-like emitter).

**Why:** Slang layout/reflection treats an empty struct as **size 0** and skips the field (`DefaultLayoutRulesImpl::AddStructField`, `slang-type-layout.cpp:339`), so reflection reports the *next* field at offset 0. But the C-like emitter only skips `IRVoidType` fields, **not** empty-struct fields (`CLikeSourceEmitter::emitStructDeclarationsBlock`, `slang-emit-c-like.cpp:4477`), so the empty struct is emitted as a real C++ member — and `sizeof(empty struct)==1` in C++/CUDA, pushing the next field to offset 8. Host populates the param buffer per reflection (offset 0); kernel reads at offset 8 → illegal address. The layout code even documents the unmet contract: `slang-type-layout.cpp:4878` says emit "needs to also eliminate zero-size fields to be safe."

**How to apply — the non-obvious repro trigger:** the bug ONLY surfaces when the empty struct is part of the module's **public/exported** interface. `legalizeEmptyTypes` eliminates empty types that are NOT public, so a plain single-file `slangc` compile of the issue's `public`-less repro shows emit and reflection *agreeing* at offset 0 → looks fixed. Add `public` to the structs/fields (mirrors slangpy's `load_module_from_source` + `link_program` separate-compilation flow) and the empty member is retained → mismatch reappears. This is exactly the "missing public keyword" @aidanfnv flagged. When triaging empty-aggregate layout bugs reported via slangpy, always test with `public` types before concluding non-repro.

**Verify the mismatch without a GPU:** `slangc x.slang -target cuda -entry main -stage compute` (read emitted struct) + `slangc ... -reflection-json` (read field offsets), then confirm C++ offsets with `g++` (`sizeof`/`offsetof`). No CUDA toolkit or slangpy build needed to prove the offset divergence; the runtime crash is the documented consequence.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781713263122-empty-struct-cuda-layout-bug-only-repros-when-the-.md`_
