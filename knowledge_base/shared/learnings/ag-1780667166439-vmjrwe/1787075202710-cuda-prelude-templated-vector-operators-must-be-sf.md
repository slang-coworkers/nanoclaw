---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786037743487-erazjc
written_at: 2026-08-18T17:46:42.710Z
---

# CUDA prelude: templated vector operators must be SFINAE-gated + coexist with packed __half2 overloads

When converting the Slang CUDA prelude's fixed-width vector operators from per-(type,width,op) macros to templates (maintainer request on PR #12410), these facts are load-bearing and were verified offline with nvcc 12.6 `-std=c++17` (the exact flag Slang's NVRTC path passes — see `source/compiler-core/slang-nvrtc-compiler.cpp`, `cmdLine.addArg("-std=c++17")`):

- **The CUDA vector types are distinct structs, NOT one class template.** `int2`, `char4`, `__half2` etc. are unrelated types (and `bool2/3/4`, `__half3/4` are *prelude-defined* structs, not builtins — a naive prototype that references `bool2` without declaring it fails to compile). So you cannot write `template<class T,int N> VecN<T,N> operator+`. Use a **traits table**: a primary `template<class T> struct SlangCudaVectorTraits;` left undefined, with one explicit specialization per vector type carrying `kWidth`, `BoolVector` (comparison result), `kIsIntegral`.

- **A global templated `operator+(T,T)` MUST be SFINAE-constrained** to the registered types, or it becomes a candidate for every type in the program. Gate on `SlangCudaVectorTraits<T>::kWidth > 0` via a minimal in-house `enable_if` (the NVRTC prelude does NOT include `<type_traits>` — roll your own two-liner). Verified: without the gate, `struct Foo{int x,y;}; Foo+Foo` and scalar `int+int` misbehave; with it, both are correctly excluded (`no operator "+"` / template not instantiated).

- **`__half2` packed intrinsics must stay NON-template overloads.** The prelude backs `__half2` arithmetic with `__hadd2`/`__hsub2`/`__hmul2`/`__h2div`/`__hneg2` (one `add.f16x2` vs two scalar `add.f16`). A non-template exact-match overload wins overload resolution over the template, so keeping them as plain functions preserves the packed path — verified byte-identical PTX before/after. `__half2`'s compare/logical operators and all `__half3/4` operators correctly fall through to the templates. Also: the prelude defines `__CUDA_NO_HALF2_OPERATORS__` before `#include <cuda_fp16.h>` so the toolchain's own `__half2` operators don't collide.

- **`if constexpr` width dispatch is well-formed inside a template** but NOT in a plain function: `result.z=...` for a 2-wide type is in an un-instantiated branch, so it isn't type-checked. This is exactly why the macro form couldn't use `if constexpr` and the template form can. `__device__` lambdas need `--extended-lambda` (NVRTC doesn't pass it) — so splice the operator token directly, no lambdas.

- **Codegen parity check the maintainer asked for:** 33-kernel PTX sweep old-macros vs new-templates → 32/33 identical opcode multisets; the one that differed (bool4) was one instruction *shorter* (template's direct member store vectorized to `st.global.v4.u8` where the accessor form emitted mov+store). Parse-cost is the real template win, expressed structurally: macro form = 684 concrete operator definitions parsed per TU; template form = 21 templates + 13 packed overloads. Don't claim a wall-clock compile-time win at small scale — it's within noise; report the definition count.
