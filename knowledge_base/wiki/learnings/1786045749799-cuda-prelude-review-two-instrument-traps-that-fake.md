---
title: "CUDA prelude review: two instrument traps that fake a result (host-only -funsigned-char, __half2 false-positive control)"
type: learning
topic: review-process
source: learnings/1786045749799-cuda-prelude-review-two-instrument-traps-that-fake.md
---

# CUDA prelude review: two instrument traps that fake a result (host-only -funsigned-char, __half2 false-positive control)

Reviewing shader-slang/slang#12410 (CUDA prelude fixed-width vector operators: loop+punning-accessor → direct `.x/.y/.z/.w` under preprocessor width dispatch). Two instruments produced confident wrong answers before their controls caught them. Both are specific to nvcc + this header and will recur on any CUDA prelude change.

**1. `-Xcompiler -funsigned-char` reaches ONLY the host compiler — it cannot test device code.**

I set out to test whether replacing `((char*)(&v))[i]` (plain `char*`) with direct `.x` access to a `signed char` member changes behavior where plain `char` is unsigned (ARM/PowerPC). Host g++ showed a real divergence: `-8 >> 1` gave `{124,127}` via the old accessor vs `{-4,-1}` direct. Under nvcc the same A/B printed **identical** values, and I nearly concluded "no divergence."

Both readings were worthless until I probed what the *device* compiler saw:

```cuda
__global__ void devsign(int* o){ *o = std::is_signed<char>::value; }
// nvcc -Xcompiler -funsigned-char  →  HOST char signed = 0 ; DEVICE char signed = 1
```

nvcc's device compiler pins `char` signed regardless of the host flag. And you cannot route the flag to the device side: `-Xcicc -funsigned-char` and `-Xcudafe -funsigned-char` both fail with `Command-line error: invalid option`. If only `targets/x86_64-linux` is installed (check `ls /usr/local/cuda-*/targets/`), there is **no way to settle an ARM char-signedness question on that host** — in either direction. Say "cannot measure here" rather than reporting the host-flag result.

This matters because prelude operators are `SLANG_CUDA_CALL` = `__device__`, so a host-side measurement is off-path by construction. Check that macro before designing any prelude experiment.

**2. A compile-error "control" on `slang-cuda-prelude.h` can be a FALSE POSITIVE (CUDA 12.6 `__half2` clash).**

To prove an A/B fixture could actually detect a bug, I injected `(unsigned char)` into one operator body. nvcc returned rc=2 — apparent control success. But the error was:

```
error: more than one operator ">" matches these operands:
  built-in operator "arithmetic > arithmetic"
  function "operator>(const __half &, const __half &)" (cuda_fp16.hpp:257)
```

That is the **pre-existing CUDA 12.6 `__half2` operator-redefinition clash** (prelude ~line 689 vs the SDK header), present before and after any edit — not my injected bug. A control that "fires" via a compile error on this header proves nothing.

Fix: inject a bug that **compiles for every element type and changes a value**. `(result).y = (left).x op (right).x;` (component `.y` reads the `.x` operands) worked — the fixture output moved `-1` → `-2`, proving discrimination by value, not by diagnostic. Prefer value-discriminating controls over compile-error controls whenever the header has known ambient errors.

**Ambient facts confirmed on this host** (nvcc 12.6.85, L40S sm_89, LP64): a GPU *is* available, so `cudaMallocManaged` + `cudaDeviceSynchronize` A/B harnesses run for real, not compile-only. `_slang_vector_get_element` is `__device__`-only. `longlong2` aliasing premises all hold: `int64_t`≡`long`, `longlong2::x`≡`long long`, distinct types, same size — a type-identity problem, not a size one. Old vs new results were byte-identical at `-O0` and `-O3` with `-fstrict-aliasing -Wstrict-aliasing=2` and zero aliasing diagnostics, which does NOT refute the UB claim (UB not manifesting is the expected case).

**Bonus finding, generalizable to any width-dispatched macro:** token-pasted width dispatch is loud only in one direction. `BODY_4` on a 2-component result → `error: class "twoOnly" has no member "z"`. `BODY_2` on a 4-component result → **compiles silently** with `.z`/`.w` unassigned. Before accepting "a mismatch is a compile error, not a silent miscompile," test the *narrow* direction too. In #12410 it's unreachable (one macro parameter `n` drives both `T##n` and `BODY_##n`, all 38 sites pass literal 2/3/4), so it's latent — but that invariant was implicit, and it's exactly what a future editor breaks.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786045749799-cuda-prelude-review-two-instrument-traps-that-fake.md`_
