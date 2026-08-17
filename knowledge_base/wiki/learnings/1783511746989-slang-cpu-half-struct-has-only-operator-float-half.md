---
title: "slang CPU-half struct has only operator float — half→int cast fails (11996)"
type: learning
topic: slang-compiler
source: learnings/1783511746989-slang-cpu-half-struct-has-only-operator-float-half.md
---

# slang CPU-half struct has only operator float — half→int cast fails (11996)

**shader-slang/slang#11996** — CPU/LLVM backend rejects a direct `half`→integer cast: `error: cannot convert 'half' to 'int8_t' without a conversion operator`. Workaround `(int8_t)(float)h` compiles.

**Root cause (verified at HEAD 33f9ed0ce, llvm 21.1):** Under the LLVM/CPU backend, `SLANG_LLVM` is defined, which gates OUT the native-`_Float16` enablement block in `prelude/slang-cpp-scalar-intrinsics.h:647-661`. So `FLT16_MIN`/`__STDCPP_FLOAT16_T__` are never set and `half` always resolves to the **fallback `struct half`** (:667-714). That struct declares only `explicit operator float()` (:712) — no integer/double/bool conversion operators. The emitter lowers `(int8_t)half` to a single `kIROp_CastFloatToInt` and emits a functional-style cast `int8_t(halfValue)` (`slang-emit-c-like.cpp:2428-2434`; the cpp override `slang-emit-cpp.cpp:1505-1531` only special-cases vector casts, returns false for scalars → falls through).

**Non-obvious C++ fact (empirically verified on clang++17 AND g++, -std=c++17):** an `explicit operator float()` does **NOT** chain through a single cast to a non-float scalar. Both `int8_t(h)` and `(int8_t)h` fail; only the explicit two-step `(int8_t)(float)h` works. This is why float→int-via-half breaks but the manual double-cast doesn't.

**Fix (Approach A, recommended + validated to compile):** add `explicit` scalar conversion operators to the fallback `struct half` at :712 — int8/16/32/64 signed+unsigned, double, bool — each implemented via `load()` (half→float→target truncation, exactly what castFloatToInt means). Keep them `explicit` (struct arithmetic ops are half×half so no ambiguity). Native `_Float16`/`std::float16_t` typedef paths convert to int natively and are unaffected. Regression test: CPU compute (`//TEST:COMPARE_COMPUTE(...):-cpu`) runs locally + CI, no GPU needed.

**Reject Approach C (make LLVM path use native `_Float16`):** `_Float16` is not supported on all host triples (failed on this x86_64 host with default triple); the block was deliberately gated to Clang15+/GCC12+ (PR #9135 / 6515cd98c). High blast radius.

Related but distinct: learning 1782814479057 is the GLSL emitter half-float *literal* path — different backend.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783511746989-slang-cpu-half-struct-has-only-operator-float-half.md`_
