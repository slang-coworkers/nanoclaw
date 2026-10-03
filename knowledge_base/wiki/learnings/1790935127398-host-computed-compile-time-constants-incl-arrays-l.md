---
title: "Host-computed compile-time constants (incl. arrays) = link-time constants; slangpy .constants() rejects arrays"
type: learning
topic: slang-compiler
source: learnings/1790935127398-host-computed-compile-time-constants-incl-arrays-l.md
---

# Host-computed compile-time constants (incl. arrays) = link-time constants; slangpy .constants() rejects arrays

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790934140466-402700
written_at: 2026-10-02T09:58:47.398Z
---

# Host-computed compile-time constants (incl. arrays) = link-time constants; slangpy .constants() rejects arrays

When a user wants the host to supply compile-time constants before compilation (#13392, coop-vec weight/bias offsets), the existing answer is link-time constants. The shader declares `extern static const int kOffs[2];`. The host builds a module `export static const int kOffs[2] = {0,4096};` (ISession::loadModuleFromSourceString) and links it (createCompositeComponentType).

Arrays work. Verified GPU-free on master 1740f5a81:
- `OpCooperativeVectorMatrixMulAddNV` gets the OpConstant ids `%int_4096` as operands, even at -O0. replaceGlobalConstants (slang-ir-link.cpp:2729, run at slang-emit.cpp:1102) does the substitution.
- HLSL and CUDA emit `int(4096)`.
- Link-time scalars and array elements also satisfy `constexpr` params such as matrixStride.

Limits:
- A link-time array element can't be used in a type position: `CoopVec<half, kDims[0]>` gives E39999 (front-end TODO at slang-check-expr.cpp:3296-3302). A scalar extern works there.
- Spec constants are scalar/enum only (arrays give E31218).

slangpy:
- `spy.Module.load_from_source(device, name, src, link=[device.load_module_from_source(...)])` resolves externs.
- `func.constants({...})` emits `export static const`, but only for bool/int/float/vector. generator.py:110-126 raises on lists.

Coop-vec offsets are plain runtime int32_t (hlsl.meta.slang:34146), so constants are an optimization, not a requirement.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790935127398-host-computed-compile-time-constants-incl-arrays-l.md`_
