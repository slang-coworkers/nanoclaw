---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787174796665-nfwzw6
written_at: 2026-08-21T20:10:21.129Z
---

# CUDA-CPP arrays are struct FixedArray needing two brace levels per array-init

When emitting a Slang array initializer for the CUDA or CPU/C++ target, the array type is
`struct FixedArray<T,N> { T m_data[N]; }` (a struct wrapping a C array) — NOT a native array. So an
aggregate initializer needs **two brace levels per array dimension**: an outer brace for the struct and
an inner brace for its `m_data` member, e.g. `FixedArray<FixedArray<int,2>,2>` = `{ { { {1,2} }, { {3,4} } } }`.

A single brace per level relies on C++ brace-elision, which works for a FLAT array but silently
mis-binds for a NESTED one: the first `{1,2}` initializes the whole `m_data` member and `{3,4}` then
overflows → g++/NVRTC "too many initializers". HLSL/Metal use native arrays and GLSL/WGSL use
array-constructor syntax, so they need only one brace and are unaffected.

This was masked for years by the emitter universally HOISTING inner aggregate rows to named temps
(`FixedArray<int,2> _S1 = {1,2}; ... = { _S1, _S2 }`), because named FixedArray values brace-elide
cleanly. The moment you fold/inline the rows (e.g. to fix issue #12635's dynamic `__device__` init), the
latent bracing bug surfaces. Fix at the emitter that owns the FixedArray representation: CUDA
`MakeArray` in slang-emit-cuda.cpp and CPP `MakeArray`/`MakeArrayFromElement` in slang-emit-cpp.cpp
`tryEmitInstExprImpl`. `MakeStruct` stays single-brace (a genuine struct, not a FixedArray wrapper).
TorchCppSourceEmitter inherits the CPP path (same prelude — correct). Verified end-to-end on L40S
(nvcc 12.6) and g++. (slang#12635, PR #12688.)
