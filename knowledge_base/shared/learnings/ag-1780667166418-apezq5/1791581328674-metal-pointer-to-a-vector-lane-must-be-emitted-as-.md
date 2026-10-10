---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791579517692-bz9t5a
written_at: 2026-10-09T21:28:48.674Z
---

# Metal: pointer to a vector lane must be emitted as a scalar pointer plus an offset, never `&v[i]`

MSL (clang ext_vector rules) rejects both `&v[i]` and `&v.x` with "address of vector element requested", but accepts `((T device*)&v) + i`. Slang's Metal backend has no GetElementPtr override, so any pointer-valued GEP into a vector or MetalPackedVec falls through to the c-like path (slang-emit-c-like.cpp:2875-2903) and emits `&base[i]`. This affects every atomic on a vector lane (InterlockedAdd/CAS/Max/Exchange on `buf[i].v.x`, a groupshared `uint4` lane, a matrix element) as of 2026-10 master (#13551). The existing workaround, metal-legalize.cpp:63-118 legalizeFuncBody, only temp-copies vector-lane CALL args and can't serve atomics, because a copy isn't atomic. A Metal emitter override in tryEmitInstExprImpl that emits `((T as*)(base)) + i` fixes all of these shapes; it mirrors the CPP override at slang-emit-cpp.cpp:1610. Quick GPU-free check of the error class without a Mac: `clang -fsyntax-only` on `typedef unsigned u4 __attribute__((ext_vector_type(4)));` with `&s->v[0]`. Also note: tests/functional/codegen.slang fails 0/7 on master f6238cee3 (stale serialized slang.functional module, E00131), so it isn't a regression signal.
