---
title: "Slang $P prefix + vector min/max: fix layer, prelude embedding, include-order"
type: learning
topic: slang-compiler
source: learnings/1785207760204-slang-p-prefix-vector-min-max-fix-layer-prelude-em.md
---

# Slang $P prefix + vector min/max: fix layer, prelude embedding, include-order

## Generic IComparable/IFloat min/max on a vector → E99997 ICE on cpp/cuda (slang#11075, PR #12249)

**Symptom:** `min`/`max` called from a `T:IFloat`/`IComparable` generic, specialized on `float2/3/4`, ICEs with `E99997 unexpected type in intrinsic definition` on `-target cpp`/`-target cuda` only. Regression from #9593 (IComparable min/max overloads).

**Root cause / why concrete works but generic doesn't:** The generic `IComparable min`/`max` body forwards builtin `T` to `__min_impl`/`__max_impl` = `__intrinsic_asm "$P_min($0,$1)"`. The `$P` prefix expander (`slang-intrinsic-expand.cpp` `case 'P'`) switched on `argType->getOp()`; a `kIROp_VectorType` had no case → `default: SLANG_UNEXPECTED`. **Concrete** `min(float3,float3)` works because the concrete `vector<T,N>` overloads decompose element-wise via `VECTOR_MAP_BINARY` into *scalar* `F32_min(x[i],y[i])`; the **generic** path emits a single whole-vector `$P_min` and never decomposes.

**Fix layer (maintainer-authorized, 3 areas together — meta.slang-only won't work):**
1. `$P` unwraps `IRVectorType`→element type before the switch → emits element-prefix helper `F32_min(float3,float3)`.
2. Add vector-arity prelude helpers the emitter now calls: CPU `template<int N>` over `Vector<T,N>`; CUDA explicit 2/3/4 overloads on native `floatN` via `_slang_vector_get_element(_ptr)`. Set = element types reaching the generic path that already have a scalar `_min`/`_max`: F16/F32/F64/I32/I64/U32/U64.
3. (bundled) `kIROp_IsVector` peephole folded on the *unwrapped element* type → `__isVector<vec>()` always false; fix to test the pre-unwrap type.
- Meta-only rejected: a `vector<T,N> __min_impl` overload binds at abstract-T and never re-resolves at instantiation; an `if(__isVector<T>())` short-circuit can't dispatch element-wise (no `__elementCount<T>()` at that layer).

**Reusable gotchas:**
- `slang-embed` **follows `#include`** — editing a transitively-included prelude header (`slang-cpp-scalar-intrinsics.h`) re-embeds into the built binary. Fresh worktree (no build dir) embeds cleanly.
- **Include-order trap:** device `slang-cpp-prelude.h` includes scalar-intrinsics.h *before* types.h; host prelude reverse. So `Vector<T,N>` must be **forward-declared** at the scalar-intrinsics tail (`template<typename T,int COUNT> struct Vector;`), member access binds at instantiation. Both live inside `SLANG_PRELUDE_NAMESPACE`.
- `__isVector<T>()` (and `__isFloat`/`__isInt`) **are callable in a `.slang` COMPARE_COMPUTE test** — a direct regression guard for peephole folding (verify it FAILS on pre-fix binary).
- **Pre-validate prelude templates/macros on the host** with g++ (CPU) and nvcc (CUDA) in a minimal harness — catches macro/type/overload errors in minutes vs a 20-min build. (nvcc harness needs `typedef long long longlong;` which the real prelude has.)
- **Draft-PR CI:** `gh workflow run ci.yml --ref <branch>` on a draft → benign **priority-yield**: only `wait-for-human-priority` + `check-ci` show "failure", all 40 real builds `skipped`. The `ci_failed` webhook fires but it is NOT a real failure — do not react.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785207760204-slang-p-prefix-vector-min-max-fix-layer-prelude-em.md`_
