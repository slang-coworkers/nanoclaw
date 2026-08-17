---
title: "slang#12069 endian/ptr whitelist — pointer-size fails SILENTLY, endianness fails LOUDLY"
type: learning
topic: slang-compiler
source: learnings/1783835875827-slang-12069-endian-ptr-whitelist-pointer-size-fail.md
---

# slang#12069 endian/ptr whitelist — pointer-size fails SILENTLY, endianness fails LOUDLY

In `include/slang.h`, endianness and pointer size are both derived from an architecture *whitelist* (`SLANG_PROCESSOR_X86_64|ARM_64|POWER_PC_64`). Verified subtlety (issue #12069, ilyakurdyukov): the two failure modes are **asymmetric**.

- Endianness has a guard `#if ((SLANG_BIG_ENDIAN | SLANG_LITTLE_ENDIAN) == 0) #error "Couldn't determine endianness"` — so an unlisted arch fails the build **loudly**.
- Pointer size has **no** such guard: `SLANG_PTR_IS_64 = (ARM_64|X86_64|POWER_PC_64)`, `SLANG_PTR_IS_32 = (SLANG_PTR_IS_64 ^ 1)`. On any 64-bit arch NOT in the whitelist (RISC-V rv64, LoongArch64, s390x, MIPS64), `SLANG_PTR_IS_32` silently evaluates to 1 → `SlangInt`/`SlangUInt` become 32-bit on a 64-bit target → public-ABI/struct-layout corruption, no error. This is the load-bearing bug, not the "use compiler macros" cosmetic ask.

Other verified facts: gcc & clang both predefine `__BYTE_ORDER__`/`__ORDER_LITTLE_ENDIAN__`, `__SIZEOF_POINTER__`, `__LP64__`/`_LP64`; `__POINTER_WIDTH__` is **clang-only** (gcc uses `__SIZEOF_POINTER__`); MSVC provides **none** of these (Windows is always LE; use `_WIN64` for ptr size). The both-set-endianness guard gap is real but only reachable via `SLANG_USER_CONFIG`/`-D` user override — the internal if/elif+`#ifndef` chain can never set both. The detection block is the single source of truth: it's copied verbatim into generated C++/CUDA host preludes (`build/prelude/*.h.cpp` are generated from slang.h), and `SLANG_PROCESSOR_*` atoms are consumed elsewhere (core.meta.slang intptr sizing, nvrtc, slang-llvm) — so don't remove the whitelist, only augment the endian/ptr derivation and add the symmetric pointer-size `#error`.

Triage verdict: Bug / low / P3 (latent — no *supported* target is affected; all supported arches are whitelisted). Recommend hybrid: add both guards first (symmetric ptr `#error` kills the silent miscompile), then compiler-macro-primary with whitelist fallback + `sizeof(void*)` cross-check; draft PR held for maintainer sign-off (public ABI header).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783835875827-slang-12069-endian-ptr-whitelist-pointer-size-fail.md`_
